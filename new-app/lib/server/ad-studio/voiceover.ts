import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { storageDriverName } from '@/lib/storage/driver-name'
import { ttsWithTimestamps } from '@/lib/server/ai/elevenlabs-tts'
import { durationMsFromAlignment, wordsFromAlignment } from '@/lib/server/t2v/tts-alignment'
import { adVoiceRetimedSpeed, adVoiceSettings, adVoiceTargetMs, adVoiceWordsKey } from '@/lib/ad-studio/voice'
import type { AdPlan, AdProductInput } from '@/lib/ad-studio/types'

type VoiceFailureCode = 'VOICE_TOO_LONG' | 'TTS_ERROR' | 'STORAGE_ERROR'
type VoiceTake = Awaited<ReturnType<typeof ttsWithTimestamps>>

class AdVoiceFailure extends Error {
  constructor(
    readonly code: VoiceFailureCode,
    readonly uiMessage: string,
    message: string,
  ) {
    super(message)
    this.name = 'AdVoiceFailure'
  }
}

function safeVoiceLogMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b(?:bearer|authorization|xi-api-key|api[_-]?key|token)\b[^\s,;]*/gi, '[redacted]')
    .slice(0, 240)
}

function voiceDistanceMs(durationMs: number, targetMs: number): number {
  return Math.abs(durationMs - targetMs)
}

function takeDurationMs(take: VoiceTake): number {
  return durationMsFromAlignment(take.alignment)
}

/**
 * One claimed voiceover generation per confirmed run. Initial generation may use one deliberate
 * pacing refinement take. A user-click retry passes maxTakes=1 and never touches KIE media jobs.
 */
export async function ensureAdVoiceover(
  workspaceId: string,
  runId: string,
  options: { maxTakes?: 1 | 2 } = {},
): Promise<{ status: 'ready' | 'pending' | 'failed' | 'skipped'; storageKey?: string; durationMs?: number }> {
  const db = getPrisma()
  const maxTakes = options.maxTakes ?? 2
  const run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  console.info('[ad-studio:b4] voice_begin', { runId, status: run?.status, maxTakes })
  if (!run || !['stitching','generating'].includes(run.status)) return { status: 'pending' }
  if (run.voiceoverStatus === 'ready' && run.voiceoverStorageKey) {
    return { status: 'ready', storageKey: run.voiceoverStorageKey, durationMs: run.voiceoverDurationMs ?? undefined }
  }
  if (run.voiceoverStatus === 'failed') return { status: 'failed' }
  if (run.voiceoverStatus === 'skipped') return { status: 'skipped' }
  if (run.voiceoverStatus === 'generating') return { status: 'pending' }

  const plan = run.plan as unknown as AdPlan | null
  const input = run.input as unknown as AdProductInput
  const text = plan?.script?.voiceover?.trim() || ''
  const optional = run.mode === 'image_ad_to_commercial'
  if (optional && input.voiceoverEnabled !== true && plan?.voiceoverEnabled !== true) {
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, voiceoverStatus: null },
      data: { voiceoverStatus: 'skipped' } })
    console.info('[ad-studio:b4] voice_optional_skipped', { runId })
    return { status: 'skipped' }
  }
  if (!text) {
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, voiceoverStatus: null },
      data: { voiceoverStatus: 'failed', status: 'failed', errorCode: 'INVALID_PARAMS', errorMessage: 'Voiceover script is missing.' } })
    console.warn('[ad-studio:b4] voice_script_missing', { runId })
    return { status: 'failed' }
  }

  const claimed = await db.adStudioRun.updateMany({
    where: { id: runId, workspaceId, status: { in: ['stitching','generating'] }, voiceoverStatus: null },
    data: { voiceoverStatus: 'generating' },
  })
  if (!claimed.count) return { status: 'pending' }

  console.info('[ad-studio:b4] voice_tts_start', {
    runId, textLength: text.length, customVoice: Boolean(input.voiceId || plan?.voiceId), maxTakes,
  })

  let selected: VoiceTake | null = null
  let selectedDurationMs = 0
  const plannedDurationMs = input.durationSec * 1000
  const targetVoiceMs = adVoiceTargetMs(input.durationSec)
  const initialVoice = adVoiceSettings(input.voiceId ?? plan?.voiceId, { durationSec: input.durationSec, text })

  try {
    const first = await ttsWithTimestamps({
      text,
      voice: initialVoice,
      allowModelFallback: maxTakes !== 1,
    })
    const firstDurationMs = takeDurationMs(first)
    if (firstDurationMs <= 0 || !first.audio.length) throw new Error('Empty voiceover')
    selected = first
    selectedDurationMs = firstDurationMs
    console.info('[ad-studio:b4] voice_take_measured', {
      runId, take: 1, plannedDurationMs, targetVoiceMs, actualDurationMs: firstDurationMs,
      distanceMs: voiceDistanceMs(firstDurationMs, targetVoiceMs), speed: initialVoice.speed,
    })

    const firstFitsWell = firstDurationMs <= plannedDurationMs
      && voiceDistanceMs(firstDurationMs, targetVoiceMs) <= 800
    const retimedSpeed = adVoiceRetimedSpeed(initialVoice.speed, firstDurationMs, targetVoiceMs)
    const shouldRetime = maxTakes > 1
      && !firstFitsWell
      && Math.abs(retimedSpeed - initialVoice.speed) >= 0.02

    if (shouldRetime) {
      console.info('[ad-studio:b4] voice_retime_begin', {
        runId, firstDurationMs, firstDistanceMs: voiceDistanceMs(firstDurationMs, targetVoiceMs),
        firstSpeed: initialVoice.speed, retimedSpeed,
      })
      try {
        const retimed = await ttsWithTimestamps({ text, voice: { ...initialVoice, speed: retimedSpeed } })
        const retimedDurationMs = takeDurationMs(retimed)
        if (retimedDurationMs > 0 && retimed.audio.length) {
          const retimedFits = retimedDurationMs <= plannedDurationMs
          const retimedCloser = voiceDistanceMs(retimedDurationMs, targetVoiceMs)
            < voiceDistanceMs(firstDurationMs, targetVoiceMs)
          console.info('[ad-studio:b4] voice_take_measured', {
            runId, take: 2, plannedDurationMs, targetVoiceMs, actualDurationMs: retimedDurationMs,
            distanceMs: voiceDistanceMs(retimedDurationMs, targetVoiceMs), speed: retimedSpeed,
            accepted: retimedFits && retimedCloser,
          })
          if (retimedFits && retimedCloser) {
            selected = retimed
            selectedDurationMs = retimedDurationMs
          }
        } else {
          console.warn('[ad-studio:b4] voice_retime_empty_use_first', { runId })
        }
      } catch (err) {
        console.warn('[ad-studio:b4] voice_retime_failed_use_first', {
          runId, message: safeVoiceLogMessage(err),
        })
      }
    } else {
      console.info('[ad-studio:b4] voice_retime_skipped', {
        runId, reason: firstFitsWell ? 'first_take_within_800ms_and_under_cap' : 'single_take_or_speed_unchanged',
      })
    }
  } catch (err) {
    const failure = new AdVoiceFailure(
      'TTS_ERROR',
      'Voiceover provider could not generate audio. Retry voiceover & render.',
      safeVoiceLogMessage(err),
    )
    await db.adStudioRun.updateMany({
      where: { id: runId, workspaceId, voiceoverStatus: 'generating' },
      data: { voiceoverStatus: 'failed', status: 'failed', errorCode: failure.code, errorMessage: failure.uiMessage },
    })
    console.warn('[ad-studio:b4] voice_failed_no_retry', { runId, code: failure.code, message: failure.message })
    return { status: 'failed' }
  }

  if (!selected || selectedDurationMs <= 0) {
    await db.adStudioRun.updateMany({
      where: { id: runId, workspaceId, voiceoverStatus: 'generating' },
      data: {
        voiceoverStatus: 'failed',
        status: 'failed',
        errorCode: 'TTS_ERROR',
        errorMessage: 'Voiceover provider returned no usable audio. Retry voiceover & render.',
      },
    })
    console.warn('[ad-studio:b4] voice_failed_no_retry', {
      runId, code: 'TTS_ERROR', message: 'No usable voiceover take was selected.',
    })
    return { status: 'failed' }
  }

  const overflowMs = selectedDurationMs - plannedDurationMs
  if (overflowMs > 400) {
    const failure = new AdVoiceFailure(
      'VOICE_TOO_LONG',
      'Voiceover is still too long for the selected ad length. Retry voiceover & render.',
      `best voiceover exceeded cap by ${overflowMs}ms`,
    )
    await db.adStudioRun.updateMany({
      where: { id: runId, workspaceId, voiceoverStatus: 'generating' },
      data: { voiceoverStatus: 'failed', status: 'failed', errorCode: failure.code, errorMessage: failure.uiMessage },
    })
    console.warn('[ad-studio:b4] voice_failed_no_retry', { runId, code: failure.code, message: failure.message })
    return { status: 'failed' }
  }

  // A tiny overrun is bounded at the clip/audio window. The existing render pipeline trims the
  // audio tail to durMs; no new paid generation is triggered and no video is regenerated.
  const effectiveDurationMs = Math.min(selectedDurationMs, plannedDurationMs)
  if (overflowMs > 0) {
    console.info('[ad-studio:b4] voice_tail_trim_applied', {
      runId, originalDurationMs: selectedDurationMs, effectiveDurationMs, overflowMs,
    })
  }

  const capSeconds = plannedDurationMs / 1000
  const words = wordsFromAlignment(selected.alignment, { offsetS: 0, sceneSlot: 0, spk: 0 })
    .filter(word => word.s < capSeconds)
    .map(word => ({ ...word, e: Math.min(word.e, capSeconds) }))
  const storageKey = `ws/${workspaceId}/ad-studio/${runId}/voiceover.mp3`
  const storage = getClipStorage()

  try {
    console.info('[ad-studio:b4] voice_storage_begin', { runId, wordCount: words.length })
    await storage.putBytes(storageKey, selected.audio, 'audio/mpeg')
    await storage.putJson(adVoiceWordsKey(workspaceId, runId), words)
    await db.adStudioRun.updateMany({
      where: { id: runId, workspaceId, voiceoverStatus: 'generating' },
      data: { voiceoverStatus: 'ready', voiceoverStorageKey: storageKey, voiceoverDurationMs: effectiveDurationMs },
    })
  } catch (err) {
    const failure = new AdVoiceFailure(
      'STORAGE_ERROR',
      'Voiceover audio was generated but could not be saved. Retry voiceover & render.',
      safeVoiceLogMessage(err),
    )
    await db.adStudioRun.updateMany({
      where: { id: runId, workspaceId, voiceoverStatus: 'generating' },
      data: { voiceoverStatus: 'failed', status: 'failed', errorCode: failure.code, errorMessage: failure.uiMessage },
    })
    console.warn('[ad-studio:b4] voice_failed_no_retry', { runId, code: failure.code, message: failure.message })
    return { status: 'failed' }
  }

  console.info('[ad-studio:b4] voice_stored', {
    runId, plannedDurationMs, targetVoiceMs, selectedDurationMs, effectiveDurationMs,
    storageDriver: storageDriverName(), audioPresent: true, wordCount: words.length,
    ctaHoldMs: Math.max(0, plannedDurationMs - effectiveDurationMs),
  })
  return { status: 'ready', storageKey, durationMs: effectiveDurationMs }
}

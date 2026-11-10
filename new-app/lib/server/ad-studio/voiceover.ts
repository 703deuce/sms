import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { storageDriverName } from '@/lib/storage/driver-name'
import { ttsWithTimestamps } from '@/lib/server/ai/elevenlabs-tts'
import { durationMsFromAlignment } from '@/lib/server/t2v/tts-alignment'
import { adVoiceSettings } from '@/lib/ad-studio/voice'
import type { AdPlan, AdProductInput } from '@/lib/ad-studio/types'

/**
 * Exactly one TTS attempt per confirmed run: DB claim precedes ElevenLabs.
 * A crashed or failed voice claim is not automatically reissued.
 */
export async function ensureAdVoiceover(
  workspaceId: string, runId: string,
): Promise<{ status: 'ready' | 'pending' | 'failed' | 'skipped'; storageKey?: string; durationMs?: number }> {
  const db = getPrisma()
  const run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  console.info('[ad-studio:b3] voice_begin', { runId, status: run?.status })
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
    console.info('[ad-studio:b3] voice_optional_skipped', { runId })
    return { status: 'skipped' }
  }
  if (!text) {
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, voiceoverStatus: null },
      data: { voiceoverStatus: 'failed', status: 'failed', errorCode: 'INVALID_PARAMS', errorMessage: 'Voiceover script is missing.' } })
    console.warn('[ad-studio:b3] voice_script_missing', { runId })
    return { status: 'failed' }
  }
  const claimed = await db.adStudioRun.updateMany({ where: { id: runId, workspaceId,
    status: { in: ['stitching','generating'] }, voiceoverStatus: null }, data: { voiceoverStatus: 'generating' } })
  if (!claimed.count) return { status: 'pending' }
  console.info('[ad-studio:b3] voice_tts_start', { runId, textLength: text.length, customVoice: Boolean(input.voiceId || plan?.voiceId) })
  try {
    const generated = await ttsWithTimestamps({ text, voice: adVoiceSettings(input.voiceId ?? plan?.voiceId) })
    const durationMs = durationMsFromAlignment(generated.alignment)
    if (durationMs <= 0 || !generated.audio.length) throw new Error('Empty voiceover')
    // Keep the planned timeline fixed. A too-long narration must never be
    // silently truncated by the editor or exporter.
    if (durationMs > input.durationSec * 1000) throw new Error('Voiceover exceeds the planned commercial duration')
    const storageKey = `ws/${workspaceId}/ad-studio/${runId}/voiceover.mp3`
    await getClipStorage().putBytes(storageKey, generated.audio, 'audio/mpeg')
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, voiceoverStatus: 'generating' },
      data: { voiceoverStatus: 'ready', voiceoverStorageKey: storageKey, voiceoverDurationMs: durationMs } })
    console.info('[ad-studio:b3] voice_stored', { runId, durationMs, storageDriver: storageDriverName(), audioPresent: true })
    return { status: 'ready', storageKey, durationMs }
  } catch (err) {
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, voiceoverStatus: 'generating' },
      data: { voiceoverStatus: 'failed', status: 'failed', errorCode: 'STORAGE_ERROR',
        errorMessage: 'Ad Studio could not create voiceover. No automatic retry was started.' } })
    console.warn('[ad-studio:b3] voice_failed_no_retry', { runId, type: err instanceof Error ? err.name : typeof err })
    return { status: 'failed' }
  }
}

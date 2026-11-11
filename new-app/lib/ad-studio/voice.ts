import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'
import type { T2vVoiceSettings } from '@/lib/t2v/types'

export function adVoiceWordsKey(workspaceId: string, runId: string): string {
  return `ws/${workspaceId}/ad-studio/${runId}/voiceover.words.json`
}

const clampSpeed = (speed: number): number => Math.round(Math.max(0.85, Math.min(1.15, speed)) * 100) / 100

export function adVoiceTargetMs(durationSec: 15 | 30): number {
  return Math.round(Math.max(1, durationSec - 0.7) * 1000)
}

export function adVoiceRetimedSpeed(currentSpeed: number, actualMs: number, targetMs: number): number {
  if (!Number.isFinite(actualMs) || actualMs <= 0 || !Number.isFinite(targetMs) || targetMs <= 0) {
    return clampSpeed(currentSpeed)
  }
  return clampSpeed(currentSpeed * (actualMs / targetMs))
}

/** User-chosen ElevenLabs voice, otherwise the shared George default. */
export function adVoiceSettings(
  voiceId?: string,
  pacing?: { durationSec: 15 | 30; text: string },
): T2vVoiceSettings {
  const selected = voiceId?.trim()
  const base = selected ? { ...DEFAULT_T2V_VOICE, voiceId: selected, voiceName: 'Selected voice' } : { ...DEFAULT_T2V_VOICE }
  const wordCount = pacing?.text.trim().split(/\s+/).filter(Boolean).length ?? 0
  const targetSec = pacing ? adVoiceTargetMs(pacing.durationSec) / 1000 : 0
  const speed = pacing && wordCount
    ? clampSpeed(wordCount / (targetSec * 2.6))
    : clampSpeed(base.speed)
  const voice = { ...base, speed }
  console.info('[ad-studio:b3] voice_selected', {
    custom: Boolean(selected),
    durationSec: pacing?.durationSec,
    wordCount,
    targetMs: pacing ? adVoiceTargetMs(pacing.durationSec) : undefined,
    speed: voice.speed,
  })
  return voice
}

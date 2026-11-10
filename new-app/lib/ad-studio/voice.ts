import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'
import type { T2vVoiceSettings } from '@/lib/t2v/types'

export function adVoiceWordsKey(workspaceId: string, runId: string): string {
  return `ws/${workspaceId}/ad-studio/${runId}/voiceover.words.json`
}

/** User-chosen ElevenLabs voice, otherwise the shared George default. */
export function adVoiceSettings(
  voiceId?: string,
  pacing?: { durationSec: 15 | 30; text: string },
): T2vVoiceSettings {
  const selected = voiceId?.trim()
  const base = selected ? { ...DEFAULT_T2V_VOICE, voiceId: selected, voiceName: 'Selected voice' } : { ...DEFAULT_T2V_VOICE }
  const words = pacing?.text.trim().split(/\s+/).filter(Boolean).length ?? 0
  const targetSec = pacing ? Math.max(1, pacing.durationSec - 0.5) : 0
  const speed = pacing && words
    ? Math.max(0.85, Math.min(1.15, words / (targetSec * 1.52)))
    : base.speed
  const voice = { ...base, speed: Math.round(speed * 100) / 100 }
  console.info('[ad-studio:b3] voice_selected', {
    custom: Boolean(selected), durationSec: pacing?.durationSec, words, speed: voice.speed,
  })
  return voice
}

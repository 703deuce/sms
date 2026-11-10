import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'
import type { T2vVoiceSettings } from '@/lib/t2v/types'

/** User-chosen ElevenLabs voice, otherwise the shared George default. */
export function adVoiceSettings(voiceId?: string): T2vVoiceSettings {
  const selected = voiceId?.trim()
  const voice = selected ? { ...DEFAULT_T2V_VOICE, voiceId: selected, voiceName: 'Selected voice' } : { ...DEFAULT_T2V_VOICE }
  console.info('[ad-studio:b3] voice_selected', { custom: Boolean(selected) })
  return voice
}

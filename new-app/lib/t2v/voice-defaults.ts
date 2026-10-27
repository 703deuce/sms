import type { T2vVoiceSettings } from '@/lib/t2v/types'

/** Default voice id from ElevenLabs quickstart; verified in elevenlabs-tts-smoke when keyed. */
export const DEFAULT_T2V_VOICE: T2vVoiceSettings = {
  provider: 'elevenlabs',
  voiceId: 'JBFqnCBsd6RMkjVDRZzb',
  voiceName: 'George',
  modelId: 'eleven_v4',
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  speed: 1,
}

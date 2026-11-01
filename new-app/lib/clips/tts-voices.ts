import type { T2vVoiceSettings } from '@/lib/t2v/types'
import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'

/** ElevenLabs premade voices for clip voiceover (AI-16). */
export const TTS_STOCK_VOICES: { id: string; label: string; voice: T2vVoiceSettings }[] = [
  { id: 'george', label: 'George', voice: DEFAULT_T2V_VOICE },
  {
    id: 'rachel',
    label: 'Rachel',
    voice: { ...DEFAULT_T2V_VOICE, voiceId: '21m00Tcm4TlvDq8ikWAM', voiceName: 'Rachel' },
  },
  {
    id: 'charlie',
    label: 'Charlie',
    voice: { ...DEFAULT_T2V_VOICE, voiceId: 'IKne3meq5aSn9XLyUdCD', voiceName: 'Charlie' },
  },
  {
    id: 'sarah',
    label: 'Sarah',
    voice: { ...DEFAULT_T2V_VOICE, voiceId: 'EXAVITQu4vr4xnSDxMaL', voiceName: 'Sarah' },
  },
]

export function ttsStockVoice(stockId: string): T2vVoiceSettings | null {
  return TTS_STOCK_VOICES.find((v) => v.id === stockId)?.voice ?? null
}

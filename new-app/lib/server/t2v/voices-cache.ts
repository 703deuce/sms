import 'server-only'
import { listVoices, type VoiceListItem } from '@/lib/server/ai/elevenlabs-tts'
import { logT2v, logT2vError } from '@/lib/server/t2v/log'

const TTL_MS = 15 * 60 * 1000
let cache: { at: number; voices: VoiceListItem[] } | null = null

export async function listVoicesCached(): Promise<VoiceListItem[]> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) {
    logT2v('voices', 'cache hit', { count: cache.voices.length })
    return cache.voices
  }
  try {
    logT2v('voices', 'cache miss, fetching ElevenLabs list')
    const { voices } = await listVoices({})
    cache = { at: now, voices }
    logT2v('voices', 'cache refreshed', { count: voices.length })
    return voices
  } catch (err) {
    logT2vError('voices', 'listVoices failed', err)
    if (cache) {
      logT2v('voices', 'serving stale cache after error', { count: cache.voices.length })
      return cache.voices
    }
    throw err
  }
}

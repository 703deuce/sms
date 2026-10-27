import 'server-only'
import { LiveKitAPI } from 'livekit-server-sdk'
import { getLiveKitServerEnv } from '@/lib/server/livekit/env'

let cached: LiveKitAPI | null = null

function httpHostFromWss(wssUrl: string): string {
  return wssUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://')
}

/** LiveKit Cloud API client (uses `LIVEKIT_*` only). */
export function getLiveKitApi(): LiveKitAPI {
  if (cached) return cached
  const env = getLiveKitServerEnv()
  cached = new LiveKitAPI(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, httpHostFromWss(env.LIVEKIT_URL))
  return cached
}

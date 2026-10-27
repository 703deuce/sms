import 'server-only'

/** Feature gate — Kick live HLS capture (build after Twitch stage 1 reliable). */
export function kickLiveCaptureEnabled(): boolean {
  return process.env.KICK_LIVE_CAPTURE_ENABLED === '1'
}

export type KickLiveCapturePlan = {
  slug: string
  chunkMin: number
  videoBufferMin: number
  videoHeight: number
}

const DEFAULT_CHUNK_MIN = Number(process.env.STREAMER_CHUNK_MIN || 15)
const VIDEO_BUFFER_MIN = Number(process.env.KICK_ROLLING_VIDEO_BUFFER_MIN || 15)
const VIDEO_HEIGHT = Number(process.env.KICK_ROLLING_VIDEO_HEIGHT || 720)

/** Undocumented v2 API — same as worker `kick_playback.py`. */
export async function resolveKickLiveHlsUrl(slug: string): Promise<string | null> {
  const s = slug.trim().toLowerCase()
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(s)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const live = data.livestream as Record<string, unknown> | undefined
    if (live?.is_live === false) return null
    const fromLive = [live?.source, live?.playback_url, data.playback_url].find(
      (u) => typeof u === 'string' && u.includes('m3u8'),
    )
    return (fromLive as string) || null
  } catch {
    return null
  }
}

export function kickLiveCapturePlan(slug: string): KickLiveCapturePlan {
  return {
    slug: slug.toLowerCase(),
    chunkMin: DEFAULT_CHUNK_MIN,
    videoBufferMin: VIDEO_BUFFER_MIN,
    videoHeight: VIDEO_HEIGHT,
  }
}

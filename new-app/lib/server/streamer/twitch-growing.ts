import { twitchAppAccessToken, twitchClientId } from '@/lib/server/streamer/twitch'

export type TwitchArchiveMatch = {
  id: string
  url: string
  title: string
  durationSec: number
  streamId: string | null
}

/** Resolve the in-progress or just-finished archive VOD for a Twitch channel stream. */
export async function matchTwitchArchiveVod(
  broadcasterUserId: string,
  streamedAt: Date,
  streamSessionId?: string,
): Promise<TwitchArchiveMatch | null> {
  const token = await twitchAppAccessToken()
  const res = await fetch(
    `https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(broadcasterUserId)}&type=archive&first=8`,
    {
      headers: {
        'Client-Id': twitchClientId(),
        Authorization: `Bearer ${token}`,
      },
    },
  )
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: {
      id: string
      url: string
      title: string
      duration: string
      created_at: string
      stream_id?: string
    }[]
  }
  const rows = json.data ?? []
  if (streamSessionId) {
    const byStream = rows.find((v) => String(v.stream_id || '') === String(streamSessionId))
    if (byStream) return normalizeHelixVideo(byStream)
  }
  const target = streamedAt.getTime()
  for (const v of rows) {
    const created = Date.parse(v.created_at)
    if (!Number.isNaN(created) && Math.abs(created - target) <= 15 * 60 * 1000) {
      return normalizeHelixVideo(v)
    }
  }
  return null
}

export function parseTwitchDuration(raw: string): number {
  const m = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i)
  if (!m) return 0
  const h = Number(m[1] || 0)
  const min = Number(m[2] || 0)
  const s = Number(m[3] || 0)
  return h * 3600 + min * 60 + s
}

function normalizeHelixVideo(v: {
  id: string
  url: string
  title: string
  duration: string
  stream_id?: string
}): TwitchArchiveMatch {
  return {
    id: v.id,
    url: v.url,
    title: v.title,
    durationSec: parseTwitchDuration(v.duration),
    streamId: v.stream_id ? String(v.stream_id) : null,
  }
}

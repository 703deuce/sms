import { twitchAppAccessToken, twitchClientId } from '@/lib/server/streamer/twitch'

export type TwitchArchiveVideo = {
  id: string
  url: string
  durationMs: number
  createdAt: string
  title?: string
}

function parseTwitchDuration(dur: string): number {
  // e.g. 1h2m3s
  const h = /(\d+)h/.exec(dur)?.[1]
  const m = /(\d+)m/.exec(dur)?.[1]
  const s = /(\d+)s/.exec(dur)?.[1]
  return ((Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0)) * 1000
}

/** Latest archive VOD for broadcaster (includes in-progress recording while live). */
export async function fetchLatestTwitchArchive(broadcasterUserId: string): Promise<TwitchArchiveVideo | null> {
  const token = await twitchAppAccessToken()
  const res = await fetch(
    `https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(broadcasterUserId)}&type=archive&first=1`,
    { headers: { 'Client-Id': twitchClientId(), Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: { id: string; url: string; duration: string; created_at: string; title?: string }[]
  }
  const v = json.data?.[0]
  if (!v?.id) return null
  return {
    id: v.id,
    url: v.url,
    durationMs: parseTwitchDuration(v.duration || '0s'),
    createdAt: v.created_at,
    title: v.title,
  }
}

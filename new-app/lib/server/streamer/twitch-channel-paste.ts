import 'server-only'

import { parseTwitchDuration } from '@/lib/server/streamer/twitch-growing'
import { twitchAppAccessToken, twitchClientId } from '@/lib/server/streamer/twitch'

export type TwitchChannelPasteResolution = {
  channelLogin: string
  broadcasterUserId: string
  isLive: boolean
  vodId: string
  vodUrl: string
  title: string
  durationSec: number
  source: 'live_archive' | 'latest_vod'
}

async function helixGet<T>(path: string): Promise<T> {
  const token = await twitchAppAccessToken()
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      'Client-Id': twitchClientId(),
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Twitch API error (${res.status})`)
  }
  return (await res.json()) as T
}

/** Resolve twitch.tv/channel login to the current archive VOD (in-progress when live). */
export async function resolveTwitchChannelPaste(
  channelLogin: string,
): Promise<TwitchChannelPasteResolution | { error: string }> {
  const login = channelLogin.trim().toLowerCase()
  if (!login) return { error: 'Enter a Twitch channel name.' }

  let users: { data?: { id: string; login: string }[] }
  try {
    users = await helixGet(`/users?login=${encodeURIComponent(login)}`)
  } catch {
    return { error: 'Could not reach Twitch. Try again in a moment.' }
  }
  const user = users.data?.[0]
  if (!user) return { error: 'Channel not found on Twitch.' }

  let streams: { data?: { id: string }[] }
  try {
    streams = await helixGet(`/streams?user_id=${encodeURIComponent(user.id)}`)
  } catch {
    return { error: 'Could not check whether this channel is live.' }
  }
  const liveStream = streams.data?.[0]
  const isLive = Boolean(liveStream)
  const liveStreamId = liveStream ? String(liveStream.id) : undefined

  let videos: {
    data?: { id: string; url: string; title: string; duration: string; stream_id?: string }[]
  }
  try {
    videos = await helixGet(
      `/videos?user_id=${encodeURIComponent(user.id)}&type=archive&first=8`,
    )
  } catch {
    return { error: 'Could not load VODs for this channel.' }
  }
  const rows = videos.data ?? []
  if (!rows.length) {
    return {
      error:
        'No past broadcasts found. The creator must enable “Store past broadcasts” on Twitch, or wait until an archive exists.',
    }
  }

  let pick = rows[0]
  if (isLive && liveStreamId) {
    const matched = rows.find((v) => String(v.stream_id || '') === liveStreamId)
    if (matched) pick = matched
  }

  const durationSec = parseTwitchDuration(pick.duration || '')
  if (durationSec <= 0) {
    return { error: 'Could not read VOD duration from Twitch.' }
  }

  return {
    channelLogin: user.login,
    broadcasterUserId: user.id,
    isLive,
    vodId: pick.id,
    vodUrl: pick.url || `https://www.twitch.tv/videos/${pick.id}`,
    title: pick.title,
    durationSec,
    source: isLive ? 'live_archive' : 'latest_vod',
  }
}

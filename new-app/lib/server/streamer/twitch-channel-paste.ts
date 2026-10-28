import 'server-only'

import {
  liveStreamDurationSec,
  logArchiveResolveDecision,
  pickLiveTwitchArchive,
  TWITCH_NO_LIVE_ARCHIVE_MSG,
  TWITCH_NO_PAST_BROADCASTS_MSG,
  type TwitchArchiveCandidate,
} from '@/lib/server/streamer/twitch-live-archive'
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
  source: 'live_archive' | 'live_channel' | 'latest_vod'
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
    logArchiveResolveDecision({
      login,
      live: false,
      candidates: [],
      picked: null,
      reason: 'helix_users_failed',
    })
    return { error: 'Could not reach Twitch. Try again in a moment.' }
  }
  const user = users.data?.[0]
  if (!user) {
    logArchiveResolveDecision({
      login,
      live: false,
      candidates: [],
      picked: null,
      reason: 'channel_not_found',
    })
    return { error: 'Channel not found on Twitch.' }
  }

  let streams: { data?: { id: string; started_at?: string; title?: string }[] }
  try {
    streams = await helixGet(`/streams?user_id=${encodeURIComponent(user.id)}`)
  } catch {
    logArchiveResolveDecision({
      login: user.login,
      live: false,
      candidates: [],
      picked: null,
      reason: 'helix_streams_failed',
    })
    return { error: 'Could not check whether this channel is live.' }
  }
  const liveStream = streams.data?.[0]
  const isLive = Boolean(liveStream)
  const liveStreamId = liveStream ? String(liveStream.id) : undefined
  const streamStartedAt = liveStream?.started_at

  let videos: {
    data?: {
      id: string
      url: string
      title: string
      duration: string
      created_at: string
      stream_id?: string
    }[]
  }
  try {
    videos = await helixGet(
      `/videos?user_id=${encodeURIComponent(user.id)}&type=archive&first=8`,
    )
  } catch {
    logArchiveResolveDecision({
      login: user.login,
      live: isLive,
      stream_started_at: streamStartedAt ?? null,
      candidates: [],
      picked: null,
      reason: 'helix_videos_failed',
    })
    return { error: 'Could not load VODs for this channel.' }
  }
  const rows: TwitchArchiveCandidate[] = videos.data ?? []

  if (!rows.length) {
    if (isLive && liveStreamId && streamStartedAt) {
      const channelUrl = `https://www.twitch.tv/${user.login}`
      const durationSec = liveStreamDurationSec(streamStartedAt)
      logArchiveResolveDecision({
        login: user.login,
        live: true,
        stream_started_at: streamStartedAt,
        candidates: [],
        picked: liveStreamId,
        reason: 'helix_no_archives_live_channel_url',
      })
      return {
        channelLogin: user.login,
        broadcasterUserId: user.id,
        isLive: true,
        vodId: liveStreamId,
        vodUrl: channelUrl,
        title: liveStream?.title || `${user.login} (live)`,
        durationSec,
        source: 'live_channel',
      }
    }
    logArchiveResolveDecision({
      login: user.login,
      live: isLive,
      stream_started_at: streamStartedAt ?? null,
      candidates: [],
      picked: null,
      reason: isLive ? 'helix_no_archives_not_live_ready' : 'helix_no_archives_offline',
    })
    return { error: TWITCH_NO_PAST_BROADCASTS_MSG }
  }

  if (isLive) {
    const livePick = pickLiveTwitchArchive(rows, {
      liveStreamId,
      streamStartedAt,
    })
    logArchiveResolveDecision({
      login: user.login,
      live: true,
      stream_started_at: streamStartedAt ?? null,
      candidates: rows,
      picked: livePick?.video.id ?? null,
      reason: livePick?.reason ?? 'no_matching_archive',
    })
    if (!livePick) {
      return { error: TWITCH_NO_LIVE_ARCHIVE_MSG }
    }
    const pick = livePick.video
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
      source: 'live_archive',
    }
  }

  const pick = rows[0]
  logArchiveResolveDecision({
    login: user.login,
    live: false,
    stream_started_at: null,
    candidates: rows,
    picked: pick.id,
    reason: 'latest_vod_offline',
  })
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
    source: 'latest_vod',
  }
}

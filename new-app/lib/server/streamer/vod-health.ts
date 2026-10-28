import 'server-only'

import { parseStreamUrl } from '@/lib/streamer/url'
import {
  buildVodAvailabilityView,
  type VodAvailabilityCode,
  type VodAvailabilityView,
} from '@/lib/streamer/vod-availability'
import { resolveTwitchChannelPaste } from '@/lib/server/streamer/twitch-channel-paste'
import { twitchAppAccessToken, twitchClientId } from '@/lib/server/streamer/twitch'
import { getPrisma } from '@/lib/server/db'
import { mergePlatformState } from '@/lib/server/streamer/platform-state'
import type { Prisma } from '@prisma/client'

type HelixVideo = {
  id: string
  user_id: string
  user_login: string
  title: string
  viewable?: string
  type?: string
  duration?: string
}

async function helixGet<T>(path: string): Promise<T> {
  const token = await twitchAppAccessToken()
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      'Client-Id': twitchClientId(),
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    throw new Error(`Helix ${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export async function fetchTwitchArchiveVideos(userId: string, first = 5): Promise<HelixVideo[]> {
  const json = await helixGet<{ data: HelixVideo[] }>(
    `/videos?user_id=${encodeURIComponent(userId)}&type=archive&first=${first}`,
  )
  return json.data || []
}

export async function fetchTwitchVideoById(videoId: string): Promise<HelixVideo | null> {
  const json = await helixGet<{ data: HelixVideo[] }>(
    `/videos?id=${encodeURIComponent(videoId)}`,
  )
  return json.data?.[0] ?? null
}

export async function checkTwitchChannelVodSaving(
  externalId: string,
  login: string,
): Promise<VodAvailabilityView> {
  const archives = await fetchTwitchArchiveVideos(externalId, 5)
  if (archives.length === 0) {
    return buildVodAvailabilityView('twitch', 'store_past_broadcasts_off', login)
  }
  return buildVodAvailabilityView('twitch', 'ok', login)
}

export async function checkTwitchVodUrl(videoId: string, channelLogin?: string): Promise<VodAvailabilityView> {
  const video = await fetchTwitchVideoById(videoId)
  const login = channelLogin || video?.user_login
  if (!video) {
    return buildVodAvailabilityView('twitch', 'vod_deleted', login)
  }
  const viewable = (video.viewable || 'public').toLowerCase()
  if (viewable === 'private') {
    return buildVodAvailabilityView('twitch', 'vod_private', login)
  }
  return buildVodAvailabilityView('twitch', 'ok', login)
}

/** Kick: no Helix-style archive API; replays listed on channel /videos after offline. */
export async function checkKickChannelReplays(login: string): Promise<VodAvailabilityView> {
  const slug = login.trim().toLowerCase()
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}/videos`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      return buildVodAvailabilityView('kick', 'kick_no_replays', slug)
    }
    const json = (await res.json()) as { videos?: unknown[]; data?: unknown[] }
    const list = (json.videos || json.data || []) as unknown[]
    if (!list.length) {
      return buildVodAvailabilityView('kick', 'kick_no_replays', slug)
    }
    return buildVodAvailabilityView('kick', 'ok', slug)
  } catch {
    return buildVodAvailabilityView('kick', 'kick_replay_pending', slug)
  }
}

export async function checkStreamUrlVodHealth(url: string): Promise<VodAvailabilityView> {
  const parsed = parseStreamUrl(url)
  if ('error' in parsed) {
    return {
      platform: 'twitch',
      code: 'vod_unavailable',
      status: 'blocked',
      message: parsed.error,
      checkedAt: new Date().toISOString(),
    }
  }
  if (parsed.platform === 'twitch' && parsed.kind === 'vod') {
    return checkTwitchVodUrl(parsed.id, parsed.channel)
  }
  if (parsed.platform === 'twitch' && parsed.kind === 'channel') {
    const resolved = await resolveTwitchChannelPaste(parsed.channel ?? parsed.id)
    if ('error' in resolved) {
      return {
        platform: 'twitch',
        code: 'vod_unavailable',
        status: 'blocked',
        message: resolved.error,
        checkedAt: new Date().toISOString(),
      }
    }
    return checkTwitchVodUrl(resolved.vodId, resolved.channelLogin)
  }
  if (parsed.platform === 'kick' && parsed.kind === 'vod') {
    return buildVodAvailabilityView('kick', 'ok', parsed.channel)
  }
  if (parsed.platform === 'kick') {
    return buildVodAvailabilityView('kick', 'kick_live_not_ready', parsed.channel)
  }
  return buildVodAvailabilityView('twitch', 'ok', parsed.channel)
}

export async function persistChannelVodSaving(channelId: string, view: VodAvailabilityView) {
  const prisma = getPrisma()
  const ch = await prisma.streamChannel.findUnique({ where: { id: channelId } })
  if (!ch) return
  await prisma.streamChannel.update({
    where: { id: channelId },
    data: {
      platformState: mergePlatformState(ch.platformState, { vodSaving: view }) as Prisma.InputJsonValue,
    },
  })
}

export type SkippedStreamEntry = {
  at: string
  code: VodAvailabilityCode
  message: string
  title?: string
  streamSessionId?: string
}

export async function appendChannelSkippedStream(channelId: string, entry: SkippedStreamEntry) {
  const prisma = getPrisma()
  const ch = await prisma.streamChannel.findUnique({ where: { id: channelId } })
  if (!ch) return
  const ps = (typeof ch.platformState === 'object' && ch.platformState ? ch.platformState : {}) as Record<
    string,
    unknown
  >
  const prev = Array.isArray(ps.skippedStreams) ? (ps.skippedStreams as SkippedStreamEntry[]) : []
  const next = [entry, ...prev].slice(0, 20)
  await prisma.streamChannel.update({
    where: { id: channelId },
    data: {
      platformState: mergePlatformState(ch.platformState, { skippedStreams: next }) as Prisma.InputJsonValue,
    },
  })
}

export async function recheckChannelVodHealth(channelId: string, workspaceId: string): Promise<VodAvailabilityView> {
  const ch = await getPrisma().streamChannel.findFirst({
    where: { id: channelId, workspaceId, deletedAt: null },
  })
  if (!ch) throw new Error('Channel not found')
  let view: VodAvailabilityView
  if (ch.platform === 'twitch' && ch.externalId) {
    view = await checkTwitchChannelVodSaving(ch.externalId, ch.login)
  } else if (ch.platform === 'kick') {
    view = await checkKickChannelReplays(ch.login)
  } else {
    view = buildVodAvailabilityView('twitch', 'vod_unavailable', ch.login)
  }
  await persistChannelVodSaving(channelId, view)
  return view
}

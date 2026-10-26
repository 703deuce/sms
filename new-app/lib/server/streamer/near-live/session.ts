import { defaultClipSettings, clipProjectSettingsSchema } from '@/lib/clips/settings'
import { defaultStreamerSettings, streamerSettingsSchema } from '@/lib/streamer/settings'
import { projectWordsKey } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { nearLivePollDelayMs } from '@/lib/server/streamer/near-live/chunk-range'
import type { NearLiveSessionState } from '@/lib/server/streamer/near-live/types'

export function nearLiveSessionIsActive(nl: NearLiveSessionState | null | undefined): boolean {
  return Boolean(nl && !nl.finalized && nl.projectId && nl.vodId)
}

export async function startNearLiveSession(channelId: string, streamStartedAt: Date) {
  const prisma = getPrisma()
  const channel = await prisma.streamChannel.findUnique({ where: { id: channelId } })
  if (!channel || channel.deletedAt) throw new Error('Channel not found')

  const ps = (channel.platformState as Record<string, unknown>) || {}
  const existing = ps.nearLive as NearLiveSessionState | undefined
  if (nearLiveSessionIsActive(existing)) {
    return { projectId: existing!.projectId, vodId: existing!.vodId, resumed: true }
  }

  const workspaceId = channel.workspaceId
  const streamer = streamerSettingsSchema.parse({
    ...defaultStreamerSettings(),
    ...(typeof channel.settings === 'object' && channel.settings ? channel.settings : {}),
  })
  const merged = clipProjectSettingsSchema.parse({
    ...clipProjectSettingsSchema.parse(defaultClipSettings()),
    aspectRatio: '9:16',
    genre: 'gaming',
    streamer: { ...streamer, nearLive: true },
  })

  const projectId = createId('proj')
  const vodId = createId('svod')
  const title = `Live · ${streamStartedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`

  const nearLive: NearLiveSessionState = {
    projectId,
    vodId,
    processedEndMs: 0,
    streamStartedAt: streamStartedAt.toISOString(),
    lastPollAt: null,
  }

  const pollJobId = createId('job')
  const runAfter = new Date(Date.now() + nearLivePollDelayMs())

  await prisma.$transaction(async (tx) => {
    await tx.clipProject.create({
      data: {
        id: projectId,
        workspaceId,
        title,
        settings: JSON.parse(JSON.stringify(merged)),
        status: 'PREPARING',
        stage: 'near_live',
        progress: 0,
        transcriptKey: projectWordsKey(workspaceId, projectId),
      },
    })
    await tx.streamVod.create({
      data: {
        id: vodId,
        workspaceId,
        projectId,
        channelId: channel.id,
        platform: channel.platform,
        sourceType: 'near_live',
        externalId: channel.externalId,
        title,
        triggeredBy: 'near_live',
        attestedAt: new Date(),
        streamedAt: streamStartedAt,
        priority: 25,
        state: { nearLive: true, processedEndMs: 0 },
      },
    })
    await tx.clipJob.create({
      data: {
        id: pollJobId,
        projectId,
        type: 'STREAM_NEAR_LIVE_POLL',
        status: 'QUEUED',
        priority: 25,
        payload: { channelId, vodId, projectId },
        runAfter,
      },
    })
    await tx.streamChannel.update({
      where: { id: channelId },
      data: { platformState: { ...ps, nearLive } },
    })
  })

  return { projectId, vodId, pollJobId, resumed: false }
}

export async function scheduleNearLivePoll(channelId: string, vodId: string, projectId: string, delayMs?: number) {
  const prisma = getPrisma()
  const jobId = createId('job')
  const runAfter = new Date(Date.now() + (delayMs ?? nearLivePollDelayMs()))
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId,
      type: 'STREAM_NEAR_LIVE_POLL',
      status: 'QUEUED',
      priority: 25,
      payload: { channelId, vodId, projectId },
      runAfter,
    },
  })
  return jobId
}

export async function finalizeNearLiveSession(channelId: string) {
  const prisma = getPrisma()
  const channel = await prisma.streamChannel.findUnique({ where: { id: channelId } })
  if (!channel) return null
  const ps = (channel.platformState as Record<string, unknown>) || {}
  const nl = ps.nearLive as NearLiveSessionState | undefined
  if (!nl || nl.finalized) return null

  const jobId = createId('job')
  await prisma.$transaction([
    prisma.streamChannel.update({
      where: { id: channelId },
      data: {
        platformState: {
          ...ps,
          nearLive: { ...nl, finalized: true },
        },
      },
    }),
    prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: nl.projectId,
        type: 'STREAM_NEAR_LIVE_FINALIZE',
        status: 'QUEUED',
        priority: 30,
        payload: { channelId, vodId: nl.vodId, projectId: nl.projectId },
      },
    }),
  ])
  return { jobId, projectId: nl.projectId }
}

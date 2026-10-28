import { withAutoContentDetection } from '@/lib/clips/content-detection'
import { defaultClipSettings, clipProjectSettingsSchema } from '@/lib/clips/settings'
import { defaultStreamerSettings, streamerSettingsSchema } from '@/lib/streamer/settings'
import { projectWordsKey } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { matchTwitchArchiveVod } from '@/lib/server/streamer/twitch-growing'
import { streamerAutopullUiEnabled } from '@/lib/server/streamer/autopull-ui'
import { streamerTwitchRollingEnabled } from '@/lib/server/streamer/env'

const DEFAULT_CHUNK_MIN = Math.min(
  60,
  Math.max(3, Number(process.env.STREAMER_ROLLING_CHUNK_MIN || 12)),
)

function resolveRollingChunkMin(channelSettings: unknown): number {
  const parsed = streamerSettingsSchema.safeParse(
    typeof channelSettings === 'object' && channelSettings ? channelSettings : {},
  )
  const fromSettings = parsed.success ? parsed.data.rollingChunkMin : undefined
  return Math.min(60, Math.max(3, fromSettings ?? DEFAULT_CHUNK_MIN))
}

/** Cancel queued rolling ticks and mark live sessions stopped (auto-pull off). */
export async function stopChannelRollingAutopull(channelId: string, reason: string) {
  const prisma = getPrisma()
  const vods = await prisma.streamVod.findMany({
    where: {
      channelId,
      triggeredBy: { in: ['auto', 'paste'] },
      state: { path: ['rolling', 'live'], equals: true },
    },
    select: { id: true, projectId: true, state: true },
  })
  const cancelledAll: string[] = []
  for (const vod of vods) {
    const state = (vod.state as Record<string, unknown>) || {}
    const rolling = (state.rolling as Record<string, unknown>) || {}
    const pending = await prisma.clipJob.findMany({
      where: {
        projectId: vod.projectId,
        type: 'STREAM_IMPORT',
        status: 'QUEUED',
      },
      select: { id: true, payload: true },
    })
    for (const job of pending) {
      const payload = job.payload as Record<string, unknown> | null
      if (payload?.vodId !== vod.id || payload?.rollingTick == null) continue
      await prisma.clipJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: 'Cancelled by operator (auto-pull off)',
          finishedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      })
      cancelledAll.push(job.id)
    }
    await prisma.streamVod.update({
      where: { id: vod.id },
      data: {
        state: {
          ...state,
          autoProcess: false,
          rolling: {
            ...rolling,
            live: false,
            stoppedReason: reason,
            stoppedAt: new Date().toISOString(),
          },
        },
      },
    })
    console.info(
      `[streamer:decision] ${JSON.stringify({
        ts: Date.now() / 1000,
        stage: 'streamer_autopull',
        event: 'rolling_stopped',
        channelId,
        vodId: vod.id,
        reason,
        cancelledJobIds: cancelledAll,
      })}`,
    )
  }
  return { stoppedVods: vods.length, cancelledJobIds: cancelledAll }
}

/** Stop rolling live capture for a paste (or auto) project by vod id. */
export async function stopProjectRollingAutopull(projectId: string, reason: string) {
  const prisma = getPrisma()
  const vod = await prisma.streamVod.findFirst({
    where: { projectId },
    select: { id: true, projectId: true, channelId: true, state: true },
  })
  if (!vod) return { stopped: false, cancelledJobIds: [] as string[] }
  const state = (vod.state as Record<string, unknown>) || {}
  const rolling = (state.rolling as Record<string, unknown>) || {}
  if (!rolling.live) return { stopped: false, cancelledJobIds: [] as string[] }

  const cancelledAll: string[] = []
  const pending = await prisma.clipJob.findMany({
    where: { projectId: vod.projectId, type: 'STREAM_IMPORT', status: 'QUEUED' },
    select: { id: true, payload: true },
  })
  for (const job of pending) {
    const payload = job.payload as Record<string, unknown> | null
    if (payload?.vodId !== vod.id || payload?.rollingTick == null) continue
    await prisma.clipJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        error: 'Cancelled by operator (auto-pull off)',
        finishedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      },
    })
    cancelledAll.push(job.id)
  }
  await prisma.streamVod.update({
    where: { id: vod.id },
    data: {
      state: {
        ...state,
        autoProcess: false,
        rolling: {
          ...rolling,
          live: false,
          stoppedReason: reason,
          stoppedAt: new Date().toISOString(),
        },
      },
    },
  })
  console.info(
    `[streamer:decision] ${JSON.stringify({
      ts: Date.now() / 1000,
      stage: 'streamer_autopull',
      event: 'rolling_stopped',
      projectId,
      vodId: vod.id,
      reason,
      cancelledJobIds: cancelledAll,
    })}`,
  )
  return { stopped: true, cancelledJobIds: cancelledAll }
}

/** Start a growing-VOD rolling session when Twitch goes live (stage 2). */
export async function beginTwitchRollingSession(
  channelId: string,
  startedAt: Date,
  streamSessionId?: string,
) {
  if (!streamerAutopullUiEnabled() || !streamerTwitchRollingEnabled()) return null
  const prisma = getPrisma()
  const channel = await prisma.streamChannel.findUnique({ where: { id: channelId } })
  if (!channel || channel.deletedAt || channel.platform !== 'twitch' || !channel.autoProcess) {
    return null
  }
  const existing = await prisma.streamVod.findFirst({
    where: {
      channelId,
      triggeredBy: 'auto',
      state: { path: ['rolling', 'live'], equals: true },
    },
  })
  if (existing) return { projectId: existing.projectId, vodId: existing.id, reused: true }

  const archive = channel.externalId
    ? await matchTwitchArchiveVod(channel.externalId, startedAt, streamSessionId)
    : null
  const channelUrl = channel.login ? `https://www.twitch.tv/${channel.login.toLowerCase()}` : null
  const liveCapture = !archive?.url && Boolean(channelUrl)
  const streamer = streamerSettingsSchema.parse({
    ...defaultStreamerSettings(),
    ...(typeof channel.settings === 'object' && channel.settings ? channel.settings : {}),
  })
  const merged = withAutoContentDetection(
    clipProjectSettingsSchema.parse({
      ...defaultClipSettings(),
      aspectRatio: '9:16',
      clipLenMode: streamer.clipLenMode,
      targetClipLenS: streamer.targetClipLenS,
      streamer,
    }),
  )
  const chunkMin = resolveRollingChunkMin(channel.settings)
  const parsedSettings = streamerSettingsSchema.safeParse(
    typeof channel.settings === 'object' && channel.settings ? channel.settings : {},
  )
  const maxSessionHours = parsedSettings.success ? parsedSettings.data.rollingMaxSessionHours : undefined
  const projectId = createId('proj')
  const vodId = createId('svod')
  const title = archive?.title || `Live stream ${startedAt.toISOString().slice(0, 16)}`
  const vodUrl = archive?.url ?? channelUrl

  await prisma.$transaction(async (tx) => {
    await tx.clipProject.create({
      data: {
        id: projectId,
        workspaceId: channel.workspaceId,
        title,
        settings: JSON.parse(JSON.stringify(merged)),
        status: 'QUEUED',
        stage: 'live_ingest',
        progress: 0,
        transcriptKey: projectWordsKey(channel.workspaceId, projectId),
      },
    })
    await tx.streamVod.create({
      data: {
        id: vodId,
        workspaceId: channel.workspaceId,
        projectId,
        channelId: channel.id,
        platform: 'twitch',
        sourceType: 'vod',
        externalId: archive?.id ?? channel.externalId,
        url: vodUrl,
        title,
        triggeredBy: 'auto',
        attestedAt: new Date(),
        streamedAt: startedAt,
        priority: 15,
        state: {
          autoProcess: true,
          processMode: 'rolling',
          streamSessionId: streamSessionId || archive?.streamId || undefined,
          ...(liveCapture
            ? {
                liveCapture: true,
                streamStartedAt: startedAt.toISOString(),
                archiveResolveReason: 'helix_no_archives_live_channel_url',
              }
            : {}),
          rolling: {
            live: true,
            chunkMin,
            ...(maxSessionHours != null && maxSessionHours > 0 ? { maxSessionHours } : {}),
          },
        },
      },
    })
    await tx.clipJob.create({
      data: {
        id: createId('job'),
        projectId,
        type: 'STREAM_IMPORT',
        status: 'QUEUED',
        priority: 15,
        payload: liveCapture ? { vodId } : { vodId, rollingTick: 1 },
        runAfter: liveCapture ? new Date() : new Date(Date.now() + chunkMin * 60 * 1000),
      },
    })
  })
  console.info(
    `[clipper:autopull] live_session_started channelId=${channelId} vodId=${vodId} rolling=true`,
  )
  return { projectId, vodId, reused: false }
}

/** Finalize rolling ingest after stream.offline — one more import then analyze. */
export async function finalizeTwitchRollingSession(channelId: string) {
  const prisma = getPrisma()
  const vod = await prisma.streamVod.findFirst({
    where: {
      channelId,
      triggeredBy: 'auto',
      state: { path: ['rolling', 'live'], equals: true },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!vod) return false
  const state = (vod.state as Record<string, unknown>) || {}
  const rolling = (state.rolling as Record<string, unknown>) || {}
  const pendingImport = await prisma.clipJob.findFirst({
    where: {
      projectId: vod.projectId,
      type: 'STREAM_IMPORT',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    select: { id: true },
  })
  if (pendingImport) {
    console.info(
      `[clipper:autopull] live_finalize_deduped channelId=${channelId} vodId=${vod.id} jobId=${pendingImport.id}`,
    )
    return true
  }

  await prisma.streamVod.update({
    where: { id: vod.id },
    data: {
      state: {
        ...state,
        rolling: { ...rolling, live: false, finalize: true },
      },
    },
  })
  await prisma.clipJob.create({
    data: {
      id: createId('job'),
      projectId: vod.projectId,
      type: 'STREAM_IMPORT',
      status: 'QUEUED',
      priority: 15,
      payload: { vodId: vod.id, rollingFinalize: true },
    },
  })
  console.info(`[clipper:autopull] live_finalize_queued channelId=${channelId} vodId=${vod.id}`)
  return true
}

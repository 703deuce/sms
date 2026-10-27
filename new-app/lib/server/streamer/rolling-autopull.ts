import { defaultClipSettings, clipProjectSettingsSchema } from '@/lib/clips/settings'
import { defaultStreamerSettings, streamerSettingsSchema } from '@/lib/streamer/settings'
import { projectWordsKey } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { matchTwitchArchiveVod } from '@/lib/server/streamer/twitch-growing'

const DEFAULT_CHUNK_MIN = Number(process.env.STREAMER_ROLLING_CHUNK_MIN || 12)

/** Start a growing-VOD rolling session when Twitch goes live (stage 2). */
export async function beginTwitchRollingSession(
  channelId: string,
  startedAt: Date,
  streamSessionId?: string,
) {
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
  const streamer = streamerSettingsSchema.parse({
    ...defaultStreamerSettings(),
    ...(typeof channel.settings === 'object' && channel.settings ? channel.settings : {}),
  })
  const merged = clipProjectSettingsSchema.parse({
    ...clipProjectSettingsSchema.parse(defaultClipSettings()),
    aspectRatio: '9:16',
    genre: 'gaming',
    streamer,
  })
  const projectId = createId('proj')
  const vodId = createId('svod')
  const title = archive?.title || `Live stream ${startedAt.toISOString().slice(0, 16)}`

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
        url: archive?.url ?? null,
        title,
        triggeredBy: 'auto',
        attestedAt: new Date(),
        streamedAt: startedAt,
        priority: 15,
        state: {
          processMode: 'rolling',
          streamSessionId: streamSessionId || archive?.streamId || undefined,
          rolling: { live: true, chunkMin: DEFAULT_CHUNK_MIN },
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
        payload: { vodId, rollingTick: 1 },
        runAfter: new Date(Date.now() + 2 * 60 * 1000),
      },
    })
  })
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
  return true
}

import { withAutoContentDetection } from '@/lib/clips/content-detection'
import { defaultClipSettings, clipProjectSettingsSchema } from '@/lib/clips/settings'
import { defaultStreamerSettings, streamerSettingsSchema } from '@/lib/streamer/settings'
import { projectWordsKey } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getTwitchVodDelaySec } from '@/lib/server/streamer/twitch'
import { getKickVodDelaySec } from '@/lib/server/streamer/kick'
import { streamerAutopullUiEnabled } from '@/lib/server/streamer/autopull-ui'

const AUTOPULL_DEDUPE_MS = 5 * 60 * 1000

/** Skip duplicate offline webhooks — same session or same streamedAt window with pending work. */
export async function findExistingAutopullEnqueue(
  channelId: string,
  streamedAt: Date,
  streamSessionId?: string,
): Promise<{ projectId: string; vodId: string; deduped: true } | null> {
  const prisma = getPrisma()
  const from = new Date(streamedAt.getTime() - AUTOPULL_DEDUPE_MS)
  const to = new Date(streamedAt.getTime() + AUTOPULL_DEDUPE_MS)
  const vods = await prisma.streamVod.findMany({
    where: {
      channelId,
      triggeredBy: 'auto',
      streamedAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      projectId: true,
      streamedAt: true,
      state: true,
      project: {
        select: {
          jobs: {
            where: {
              type: { in: ['STREAM_AUTOPULL', 'STREAM_IMPORT'] },
              status: { in: ['QUEUED', 'RUNNING'] },
            },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  })
  for (const v of vods) {
    const st = (v.state as Record<string, unknown>) || {}
    const sessionMatch =
      streamSessionId && String(st.streamSessionId || '') === String(streamSessionId)
    const timeMatch =
      v.streamedAt &&
      Math.abs(v.streamedAt.getTime() - streamedAt.getTime()) <= AUTOPULL_DEDUPE_MS
    const pending = (v.project?.jobs?.length ?? 0) > 0
    if (sessionMatch || (timeMatch && pending)) {
      return { projectId: v.projectId, vodId: v.id, deduped: true }
    }
  }
  return null
}

export async function enqueueStreamAutopull(
  channelId: string,
  streamedAt: Date,
  opts?: { title?: string; platform?: string; streamSessionId?: string },
) {
  if (!streamerAutopullUiEnabled()) {
    throw new Error('Auto-pull is disabled (set STREAMER_AUTOPULL_ENABLED=1 after reliability sign-off)')
  }
  const prisma = getPrisma()
  const channel = await prisma.streamChannel.findUnique({
    where: { id: channelId },
    include: { workspace: true },
  })
  if (!channel || channel.deletedAt) throw new Error('Channel not found')

  const existing = await findExistingAutopullEnqueue(
    channelId,
    streamedAt,
    opts?.streamSessionId,
  )
  if (existing) {
    console.info(
      `[clipper:autopull] deduped channelId=${channelId} vodId=${existing.vodId} projectId=${existing.projectId}`,
    )
    return { projectId: existing.projectId, vodId: existing.vodId }
  }

  const workspaceId = channel.workspaceId
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
  const projectId = createId('proj')
  const vodId = createId('svod')
  const title = opts?.title || `Stream ${streamedAt.toISOString().slice(0, 10)}`
  const delaySec = channel.platform === 'kick' ? getKickVodDelaySec() : getTwitchVodDelaySec()
  const runAfter = new Date(Date.now() + delaySec * 1000)

  await prisma.$transaction(async (tx) => {
    await tx.clipProject.create({
      data: {
        id: projectId,
        workspaceId,
        title,
        settings: JSON.parse(JSON.stringify(merged)),
        status: 'QUEUED',
        stage: 'queued',
        progress: 0,
        transcriptKey: projectWordsKey(workspaceId, projectId),
      },
    })
    const streamSessionId = opts?.streamSessionId?.trim() || undefined
    await tx.streamVod.create({
      data: {
        id: vodId,
        workspaceId,
        projectId,
        channelId: channel.id,
        platform: channel.platform,
        sourceType: 'vod',
        externalId: channel.externalId,
        title,
        triggeredBy: 'auto',
        attestedAt: new Date(),
        streamedAt,
        priority: 15,
        state: streamSessionId ? { streamSessionId } : {},
      },
    })
    await tx.clipJob.create({
      data: {
        id: createId('job'),
        projectId,
        type: 'STREAM_AUTOPULL',
        status: 'QUEUED',
        priority: 15,
        payload: { vodId, attempt: 1 },
        runAfter,
      },
    })
  })
  return { projectId, vodId }
}

import { defaultClipSettings, clipProjectSettingsSchema } from '@/lib/clips/settings'
import { defaultStreamerSettings, streamerSettingsSchema } from '@/lib/streamer/settings'
import { projectWordsKey } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getTwitchVodDelaySec } from '@/lib/server/streamer/twitch'
import { getKickVodDelaySec } from '@/lib/server/streamer/kick'
import { streamerAutopullUiEnabled } from '@/lib/server/streamer/autopull-ui'

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
  const workspaceId = channel.workspaceId
  const streamer = streamerSettingsSchema.parse({
    ...defaultStreamerSettings(),
    ...(typeof channel.settings === 'object' && channel.settings ? channel.settings : {}),
  })
  const baseSettings = clipProjectSettingsSchema.parse(defaultClipSettings())
  const merged = clipProjectSettingsSchema.parse({
    ...baseSettings,
    aspectRatio: '9:16',
    genre: 'gaming',
    streamer,
  })
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

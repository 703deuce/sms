import { withAutoContentDetection } from '@/lib/clips/content-detection'
import { defaultClipSettings, clipProjectSettingsSchema } from '@/lib/clips/settings'
import { defaultStreamerSettings, streamerSettingsSchema } from '@/lib/streamer/settings'
import { parseStreamUrl } from '@/lib/streamer/url'
import { resolveTwitchChannelPaste } from '@/lib/server/streamer/twitch-channel-paste'
import { projectWordsKey } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { STREAMER_MAX_VOD_HOURS } from '@/lib/server/streamer/limits'
import { assertStreamCap } from '@/lib/server/streamer/usage'

export async function createStreamerImport(
  workspaceId: string,
  input: {
    url?: string
    uploadId?: string
    rangeStartMs?: number
    rangeEndMs?: number
    settings?: unknown
    attest: boolean
  },
) {
  if (input.url && !input.attest) {
    throw new Error('You must confirm permission to import this stream')
  }

  const prisma = getPrisma()
  const streamer = streamerSettingsSchema.parse({
    ...defaultStreamerSettings(),
    ...(typeof input.settings === 'object' && input.settings ? input.settings : {}),
  })

  let platform = 'upload'
  let sourceType = 'upload'
  let externalId: string | null = null
  let channelLogin: string | null = null
  let url = input.url?.trim() || null
  let title = 'Streamer upload'

  let rangeStartMs = input.rangeStartMs ?? 0
  let rangeEndMs = input.rangeEndMs ?? 0
  if (rangeEndMs > rangeStartMs) {
    const rangeH = (rangeEndMs - rangeStartMs) / 3_600_000
    if (rangeH > STREAMER_MAX_VOD_HOURS) {
      throw new Error(`Range exceeds ${STREAMER_MAX_VOD_HOURS} hour limit`)
    }
    await assertStreamCap(workspaceId, Math.floor((rangeEndMs - rangeStartMs) / 1000))
  }

  if (url) {
    const parsed = parseStreamUrl(url)
    if ('error' in parsed) throw new Error(parsed.error)

    if (parsed.platform === 'twitch' && parsed.kind === 'channel') {
      const login = parsed.channel ?? parsed.id
      const resolved = await resolveTwitchChannelPaste(login)
      if ('error' in resolved) throw new Error(resolved.error)
      url = resolved.vodUrl
      platform = 'twitch'
      sourceType = 'vod'
      externalId = resolved.vodId
      channelLogin = resolved.channelLogin
      title = resolved.title
      const durationMs = resolved.durationSec * 1000
      if (rangeEndMs > rangeStartMs) {
        rangeEndMs = Math.min(rangeEndMs, durationMs)
        rangeStartMs = Math.max(0, Math.min(rangeStartMs, Math.max(0, rangeEndMs - 1000)))
      }
    } else {
      platform = parsed.platform
      sourceType = parsed.kind
      externalId = parsed.id
      channelLogin = parsed.channel ?? null
      title = `${parsed.platform === 'twitch' ? 'Twitch' : 'Kick'} ${parsed.kind} ${parsed.id}`
    }
  }

  const merged = withAutoContentDetection(
    clipProjectSettingsSchema.parse({
      ...defaultClipSettings(),
      aspectRatio: '9:16',
      clipLenMode: streamer.clipLenMode,
      targetClipLenS: streamer.targetClipLenS,
      streamer,
      rangeStartMs,
      rangeEndMs,
    }),
  )

  const projectId = createId('proj')
  const vodId = createId('svod')

  if (input.uploadId) {
    const upload = await prisma.clipUpload.findFirst({
      where: { id: input.uploadId, workspaceId, status: 'COMPLETE' },
    })
    if (!upload) throw new Error('Upload not complete')
    title = upload.filename.replace(/\.[^.]+$/, '')
    merged.rangeEndMs = upload.durationMs || merged.rangeEndMs
  }

  let channelId: string | null = null
  if (channelLogin && platform !== 'upload') {
    const ch = await prisma.streamChannel.upsert({
      where: { workspaceId_platform_login: { workspaceId, platform, login: channelLogin.toLowerCase() } },
      create: {
        id: createId('sch'),
        workspaceId,
        platform,
        login: channelLogin.toLowerCase(),
        status: 'PASTE_ONLY',
      },
      update: { updatedAt: new Date() },
    })
    channelId = ch.id
  }

  await prisma.$transaction(async (tx) => {
    await tx.clipProject.create({
      data: {
        id: projectId,
        workspaceId,
        title,
        uploadId: input.uploadId ?? null,
        sourceUrl: url,
        settings: JSON.parse(JSON.stringify(merged)),
        rangeStartMs,
        rangeEndMs: merged.rangeEndMs || rangeEndMs,
        status: 'QUEUED',
        stage: url ? 'importing' : 'queued',
        progress: 0,
        transcriptKey: projectWordsKey(workspaceId, projectId),
      },
    })
    await tx.streamVod.create({
      data: {
        id: vodId,
        workspaceId,
        projectId,
        channelId,
        platform,
        sourceType,
        externalId,
        url,
        title,
        rangeStartMs,
        rangeEndMs: rangeEndMs > rangeStartMs ? rangeEndMs : null,
        triggeredBy: input.uploadId ? 'upload' : 'paste',
        attestedAt: input.attest ? new Date() : null,
        priority: 10,
      },
    })
    if (url) {
      await tx.clipJob.create({
        data: {
          id: createId('job'),
          projectId,
          type: 'STREAM_IMPORT',
          status: 'QUEUED',
          priority: 10,
          payload: { vodId },
        },
      })
    } else if (input.uploadId) {
      await tx.clipJob.create({
        data: {
          id: createId('job'),
          projectId,
          type: 'STREAM_IMPORT',
          status: 'QUEUED',
          priority: 10,
          payload: { vodId },
        },
      })
    }
  })

  return { projectId, vodId }
}

import { getScriptBootstrap } from '@/lib/server/clips/script-bootstrap'
import {
  ensurePublishRenderPipeline,
  incrementPublishViewCount,
  signedPublishPlaybackUrl,
  syncPublishOutputFromRender,
} from '@/lib/server/clips/composition-share'
import { getPrisma } from '@/lib/server/db'
import { getPublicAppOrigin } from '@/lib/server/public-url'

export type PublicClipPlayback = {
  title: string
  playbackUrl: string | null
  playbackStatus: 'ready' | 'processing' | 'unavailable'
  compositionId: string
  projectId: string
  mode: 'view' | 'comment'
  viewCount: number
  showTranscript: boolean
  allowComments: boolean
  allowDownload: boolean
  transcriptText: string
  publicSlug?: string
}

async function resolvePublishPlayback(
  workspaceId: string,
  compositionId: string,
  projectId: string,
): Promise<{ playbackUrl: string | null; playbackStatus: 'ready' | 'processing' | 'unavailable' }> {
  await ensurePublishRenderPipeline(workspaceId, compositionId)
  const pub = await syncPublishOutputFromRender(compositionId)
  if (!pub) {
    return { playbackUrl: null, playbackStatus: 'unavailable' }
  }
  if (pub.outputKey) {
    const url = await signedPublishPlaybackUrl(pub.outputKey)
    return { playbackUrl: url, playbackStatus: url ? 'ready' : 'unavailable' }
  }
  const settings = (pub.settings ?? {}) as Record<string, unknown>
  const renderId = typeof settings.publishRenderId === 'string' ? settings.publishRenderId : null
  if (renderId) {
    const prisma = getPrisma()
    const render = await prisma.scriptCompositionRender.findFirst({
      where: { id: renderId, compositionId },
    })
    if (render && (render.status === 'QUEUED' || render.status === 'PROCESSING')) {
      return { playbackUrl: null, playbackStatus: 'processing' }
    }
    if (render?.status === 'READY' && render.outputKey) {
      const url = await signedPublishPlaybackUrl(render.outputKey)
      return { playbackUrl: url, playbackStatus: url ? 'ready' : 'processing' }
    }
  }
  return { playbackUrl: null, playbackStatus: 'processing' }
}

function transcriptFromBootstrap(bootstrap: Awaited<ReturnType<typeof getScriptBootstrap>>) {
  if (!bootstrap) return ''
  return bootstrap.editorWords
    .filter((w) => !bootstrap.document?.deletedWordIds?.includes(w.id))
    .map((w) => w.text)
    .join(' ')
    .slice(0, 120_000)
}

export async function getPublicShareClipPayload(linkId: string): Promise<PublicClipPlayback | null> {
  const prisma = getPrisma()
  const link = await prisma.scriptCompositionShareLink.findFirst({
    where: { id: linkId, revokedAt: null },
    include: { composition: { include: { project: true } } },
  })
  if (!link || link.linkAccess === 'INVITE_ONLY') return null

  const workspaceId = link.workspaceId
  const projectId = link.composition.projectId
  const compositionId = link.compositionId
  const bootstrap = await getScriptBootstrap(workspaceId, projectId)
  if (!bootstrap) return null

  const publish = await prisma.scriptCompositionPublish.findUnique({ where: { compositionId } })
  const settings = (publish?.settings ?? {}) as Record<string, unknown>
  const playback = await resolvePublishPlayback(workspaceId, compositionId, projectId)
  const viewCount = await incrementPublishViewCount(compositionId)

  return {
    title: link.composition.title || bootstrap.title,
    ...playback,
    compositionId,
    projectId,
    mode: link.linkAccess === 'LINK_COMMENT' ? 'comment' : 'view',
    viewCount,
    showTranscript: settings.showTranscript !== false,
    allowComments: settings.allowComments === true || link.linkAccess === 'LINK_COMMENT',
    allowDownload: settings.allowDownload === true && playback.playbackStatus === 'ready',
    transcriptText: transcriptFromBootstrap(bootstrap),
  }
}

export async function getPublicPublishPayload(publicSlug: string): Promise<PublicClipPlayback | null> {
  const prisma = getPrisma()
  const pub = await prisma.scriptCompositionPublish.findUnique({
    where: { publicSlug },
    include: { composition: { include: { project: true } } },
  })
  if (!pub) return null

  const bootstrap = await getScriptBootstrap(pub.workspaceId, pub.composition.projectId)
  if (!bootstrap) return null

  const settings = (pub.settings ?? {}) as Record<string, unknown>
  const playback = await resolvePublishPlayback(pub.workspaceId, pub.compositionId, pub.composition.projectId)
  const viewCount = await incrementPublishViewCount(pub.compositionId)

  return {
    title: pub.composition.title || bootstrap.title,
    ...playback,
    compositionId: pub.compositionId,
    projectId: pub.composition.projectId,
    publicSlug,
    mode: 'view',
    viewCount,
    showTranscript: settings.showTranscript !== false,
    allowComments: settings.allowComments === true,
    allowDownload: settings.allowDownload === true && playback.playbackStatus === 'ready',
    transcriptText: transcriptFromBootstrap(bootstrap),
  }
}

export function publishedPageUrl(publicSlug: string) {
  const origin = getPublicAppOrigin()
  const path = `/share/p/${publicSlug}`
  return origin ? `${origin}${path}` : path
}

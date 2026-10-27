import { getScriptBootstrap } from '@/lib/server/clips/script-bootstrap'
import { resolveShareLinkById } from '@/lib/server/clips/composition-share'
import { getPrisma } from '@/lib/server/db'

export async function getPublicShareClipPayload(linkId: string) {
  const link = await resolveShareLinkById(linkId)
  if (!link || link.linkAccess === 'INVITE_ONLY' || link.revokedAt) return null

  const workspaceId = link.workspaceId
  const projectId = link.composition.projectId
  const bootstrap = await getScriptBootstrap(workspaceId, projectId)
  if (!bootstrap?.sourceVideoUrl) return null

  const prisma = getPrisma()
  const publish = await prisma.scriptCompositionPublish.findUnique({
    where: { compositionId: link.compositionId },
  })
  const settings = (publish?.settings ?? {}) as Record<string, unknown>

  const words = bootstrap.editorWords
    .filter((w) => !bootstrap.document?.deletedWordIds?.includes(w.id))
    .map((w) => w.text)
    .join(' ')

  return {
    title: link.composition.title || bootstrap.title,
    sourceVideoUrl: bootstrap.sourceVideoUrl,
    compositionId: link.compositionId,
    projectId,
    mode: link.linkAccess === 'LINK_COMMENT' ? 'comment' : 'view',
    viewCount: publish?.viewCount ?? 0,
    showTranscript: settings.showTranscript !== false,
    allowComments: settings.allowComments === true || link.linkAccess === 'LINK_COMMENT',
    allowDownload: settings.allowDownload === true,
    transcriptText: words.slice(0, 120_000),
  }
}

export async function getPublicPublishPayload(publicSlug: string) {
  const prisma = getPrisma()
  const pub = await prisma.scriptCompositionPublish.findUnique({
    where: { publicSlug },
    include: { composition: { include: { project: true } } },
  })
  if (!pub) return null

  const bootstrap = await getScriptBootstrap(pub.workspaceId, pub.composition.projectId)
  if (!bootstrap?.sourceVideoUrl) return null

  const settings = (pub.settings ?? {}) as Record<string, unknown>
  const words = bootstrap.editorWords
    .filter((w) => !bootstrap.document?.deletedWordIds?.includes(w.id))
    .map((w) => w.text)
    .join(' ')

  return {
    title: pub.composition.title || bootstrap.title,
    sourceVideoUrl: bootstrap.sourceVideoUrl,
    compositionId: pub.compositionId,
    projectId: pub.composition.projectId,
    publicSlug,
    showTranscript: settings.showTranscript !== false,
    allowComments: settings.allowComments === true,
    allowDownload: settings.allowDownload === true,
    transcriptText: words.slice(0, 120_000),
  }
}

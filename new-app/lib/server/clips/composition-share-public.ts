import { getScriptBootstrap } from '@/lib/server/clips/script-bootstrap'
import {
  ensurePublishRenderPipeline,
  incrementPublishViewCount,
  signedPublishPlaybackUrl,
  syncPublishOutputFromRender,
} from '@/lib/server/clips/composition-share'
import { getWorkspaceBrandForShare } from '@/lib/server/clips/workspace-brand-share'
import { getPrisma } from '@/lib/server/db'
import { getPublicAppOrigin } from '@/lib/server/public-url'

export type ViewEventDto = { at: string; label?: string }

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
  requireSignInToView?: boolean
  requireSignInToEmbed?: boolean
  signInRequired?: boolean
  brandName?: string
  brandLogoUrl?: string | null
  brandAccentColor?: string | null
  authorName?: string | null
  publishedAt?: string | null
  viewEvents?: ViewEventDto[]
  canEdit?: boolean
}

export type PublicShareRequestContext = {
  embed?: boolean
  viewerSignedIn?: boolean
}

function parseViewEvents(settings: Record<string, unknown>): ViewEventDto[] {
  if (!Array.isArray(settings.viewEvents)) return []
  return settings.viewEvents
    .filter((e): e is { at: string; label?: string } => e != null && typeof e === 'object' && typeof (e as { at?: unknown }).at === 'string')
    .slice(0, 50)
}

function viewerLooksSignedIn(request?: Request): boolean {
  if (!request) return false
  const cookie = request.headers.get('cookie') ?? ''
  if (/new-app-viewer=1/.test(cookie)) return true
  if (/sb-[^=]+-auth-token=/.test(cookie)) return true
  if (process.env.DEV_AUTH_BYPASS === '1' && cookie.includes('dev-auth')) return true
  return false
}

function accessBlocked(
  settings: Record<string, unknown>,
  ctx: PublicShareRequestContext,
): boolean {
  const signedIn = ctx.viewerSignedIn === true
  if (ctx.embed && settings.requireSignInToEmbed === true) return !signedIn
  if (settings.requireSignInToView === true) return !signedIn
  return false
}

async function enrichPublicPayload(
  base: Omit<PublicClipPlayback, 'brandName' | 'brandLogoUrl' | 'brandAccentColor' | 'viewEvents' | 'signInRequired'>,
  workspaceId: string,
  settings: Record<string, unknown>,
  ctx: PublicShareRequestContext,
  authorName?: string | null,
  publishedAt?: Date | null,
): Promise<PublicClipPlayback> {
  const brand = await getWorkspaceBrandForShare(workspaceId)
  const blocked = accessBlocked(settings, ctx)
  return {
    ...base,
    playbackUrl: blocked ? null : base.playbackUrl,
    transcriptText: blocked ? '' : base.transcriptText,
    signInRequired: blocked,
    requireSignInToView: settings.requireSignInToView === true,
    requireSignInToEmbed: settings.requireSignInToEmbed === true,
    brandName: brand.brandName,
    brandLogoUrl: brand.logoUrl,
    brandAccentColor: brand.accentColor,
    authorName: authorName ?? null,
    publishedAt: publishedAt?.toISOString() ?? null,
    viewEvents: parseViewEvents(settings),
  }
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

export async function getPublicShareClipPayload(
  linkId: string,
  request?: Request,
): Promise<PublicClipPlayback | null> {
  const url = request ? new URL(request.url) : null
  const ctx: PublicShareRequestContext = {
    embed: url?.searchParams.get('embed') === '1',
    viewerSignedIn: viewerLooksSignedIn(request),
  }
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
  const viewCount = accessBlocked(settings, ctx) ? (publish?.viewCount ?? 0) : await incrementPublishViewCount(compositionId)

  const author =
    settings.showAuthor !== false
      ? typeof settings.authorDisplayName === 'string'
        ? settings.authorDisplayName
        : null
      : null

  return enrichPublicPayload(
    {
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
    },
    workspaceId,
    settings,
    ctx,
    author,
    publish?.publishedAt ?? null,
  )
}

export async function getPublicPublishPayload(
  publicSlug: string,
  request?: Request,
): Promise<PublicClipPlayback | null> {
  const url = request ? new URL(request.url) : null
  const ctx: PublicShareRequestContext = {
    embed: url?.searchParams.get('embed') === '1',
    viewerSignedIn: viewerLooksSignedIn(request),
  }
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
  const viewCount = accessBlocked(settings, ctx) ? pub.viewCount : await incrementPublishViewCount(pub.compositionId)

  const author =
    settings.showAuthor !== false
      ? typeof settings.authorDisplayName === 'string'
        ? settings.authorDisplayName
        : null
      : null

  return enrichPublicPayload(
    {
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
    },
    pub.workspaceId,
    settings,
    ctx,
    author,
    pub.publishedAt,
  )
}

export function publishedPageUrl(publicSlug: string) {
  const origin = getPublicAppOrigin()
  const path = `/share/p/${publicSlug}`
  return origin ? `${origin}${path}` : path
}

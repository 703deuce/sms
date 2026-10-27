import type { Prisma, ScriptLinkAccess, ScriptShareRole } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { generateShareToken, hashShareToken } from '@/lib/screenwriting/sharing/token'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { enqueueCompositionExport } from '@/lib/server/clips/composition-export'
import { getPublicAppOrigin } from '@/lib/server/public-url'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'

export type ShareAccessDto = {
  collaborators: { userId: string; name: string; email: string; role: ScriptShareRole }[]
  linkAccess: ScriptLinkAccess
  shareUrl: string | null
  canCopyLink: boolean
}

export async function getCompositionShareAccess(workspaceId: string, compositionId: string, baseUrl: string) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null

  const prisma = getPrisma()
  const [collabs, link] = await Promise.all([
    prisma.scriptCompositionCollaborator.findMany({ where: { compositionId } }),
    prisma.scriptCompositionShareLink.findFirst({
      where: { compositionId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const userIds = collabs.map((c) => c.userId)
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : []

  let shareUrl: string | null = null
  if (link && link.linkAccess !== 'INVITE_ONLY') {
    shareUrl = `${baseUrl}/share/clips/${link.id}`
  }

  return {
    collaborators: users.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      role: collabs.find((c) => c.userId === u.id)?.role ?? 'VIEW',
    })),
    linkAccess: link?.linkAccess ?? 'INVITE_ONLY',
    shareUrl,
    canCopyLink: Boolean(link && link.linkAccess !== 'INVITE_ONLY'),
  } satisfies ShareAccessDto
}

export async function ensureShareLink(workspaceId: string, compositionId: string, createdById: string) {
  const prisma = getPrisma()
  const existing = await prisma.scriptCompositionShareLink.findFirst({
    where: { compositionId, revokedAt: null },
  })
  if (existing) return existing

  const token = generateShareToken()
  return prisma.scriptCompositionShareLink.create({
    data: {
      id: createId('sshl'),
      compositionId,
      workspaceId,
      tokenHash: hashShareToken(token),
      role: 'VIEW',
      linkAccess: 'INVITE_ONLY',
      createdById,
    },
  })
}

export async function updateLinkAccess(
  workspaceId: string,
  compositionId: string,
  linkAccess: ScriptLinkAccess,
  userId: string,
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null
  await ensureShareLink(workspaceId, compositionId, userId)
  const prisma = getPrisma()
  await prisma.scriptCompositionShareLink.updateMany({
    where: { compositionId, revokedAt: null },
    data: { linkAccess },
  })
  if (linkAccess === 'LINK_VIEW' || linkAccess === 'LINK_COMMENT') {
    await ensurePublishRenderPipeline(workspaceId, compositionId)
  }
  return linkAccess
}

export async function inviteCollaborator(
  workspaceId: string,
  compositionId: string,
  email: string,
  role: ScriptShareRole,
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }

  const prisma = getPrisma()
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user) return { ok: false as const, code: 'USER_NOT_FOUND' as const }

  const member = await prisma.membership.findFirst({ where: { workspaceId, userId: user.id } })
  if (!member) return { ok: false as const, code: 'NOT_IN_WORKSPACE' as const }

  await prisma.scriptCompositionCollaborator.upsert({
    where: { compositionId_userId: { compositionId, userId: user.id } },
    create: { id: createId('scol'), compositionId, userId: user.id, role },
    update: { role },
  })

  return { ok: true as const, userId: user.id }
}

export type PublishSettings = {
  showTranscript?: boolean
  allowComments?: boolean
  allowDownload?: boolean
  showAuthor?: boolean
  requireSignInToView?: boolean
  requireSignInToEmbed?: boolean
  viewEvents?: { at: string; label?: string }[]
}

const PUBLISH_RENDER_SETTINGS = {
  exportKind: 'video' as const,
  resolution: '1080p' as const,
  quality: 'recommended' as const,
  burnCaptions: true,
  includeSubtitleTrack: false,
}

async function upsertPublishRecord(
  workspaceId: string,
  compositionId: string,
  settings: PublishSettings,
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null

  const prisma = getPrisma()
  const slug = createId('pub').replace(/[^a-z0-9]/gi, '').slice(0, 16) || createId('pub')

  const existing = await prisma.scriptCompositionPublish.findUnique({ where: { compositionId } })
  const mergedSettings = {
    ...((existing?.settings ?? {}) as Record<string, unknown>),
    ...settings,
  }

  return prisma.scriptCompositionPublish.upsert({
    where: { compositionId },
    create: {
      id: createId('scpb'),
      compositionId,
      workspaceId,
      publicSlug: slug,
      settings: mergedSettings,
    },
    update: { settings: mergedSettings, updatedAt: new Date() },
  })
}

export async function ensurePublishRenderPipeline(workspaceId: string, compositionId: string) {
  const prisma = getPrisma()
  let pub = await prisma.scriptCompositionPublish.findUnique({ where: { compositionId } })
  if (!pub) {
    pub = await upsertPublishRecord(workspaceId, compositionId, {})
  }
  if (!pub) return null

  const prev = (pub.settings ?? {}) as Record<string, unknown>
  const existingRenderId = typeof prev.publishRenderId === 'string' ? prev.publishRenderId : null
  if (existingRenderId) {
    const existingRender = await prisma.scriptCompositionRender.findFirst({
      where: { id: existingRenderId, compositionId },
    })
    if (existingRender && existingRender.status !== 'FAILED') {
      return pub
    }
  }

  const render = await enqueueCompositionExport(workspaceId, compositionId, PUBLISH_RENDER_SETTINGS)
  if (!render) return pub
  return prisma.scriptCompositionPublish.update({
    where: { id: pub.id },
    data: {
      settings: { ...prev, publishRenderId: render.renderId } as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  })
}

export async function syncPublishOutputFromRender(compositionId: string) {
  const prisma = getPrisma()
  const pub = await prisma.scriptCompositionPublish.findUnique({ where: { compositionId } })
  if (!pub) return null
  const settings = (pub.settings ?? {}) as Record<string, unknown>
  const renderId = typeof settings.publishRenderId === 'string' ? settings.publishRenderId : null
  if (!renderId) return pub
  const render = await prisma.scriptCompositionRender.findFirst({
    where: { id: renderId, compositionId },
  })
  if (render?.status === 'READY' && render.outputKey && render.outputKey !== pub.outputKey) {
    return prisma.scriptCompositionPublish.update({
      where: { id: pub.id },
      data: { outputKey: render.outputKey, updatedAt: new Date() },
    })
  }
  return pub
}

export async function signedPublishPlaybackUrl(outputKey: string | null | undefined) {
  if (!outputKey) return null
  const storage = getClipStorage()
  return createCachedSignedDownloadUrl(storage, outputKey)
}

export async function upsertPublish(
  workspaceId: string,
  compositionId: string,
  settings: PublishSettings,
) {
  const pub = await upsertPublishRecord(workspaceId, compositionId, settings)
  if (!pub) return null
  await ensurePublishRenderPipeline(workspaceId, compositionId)
  return syncPublishOutputFromRender(compositionId)
}

export function shareBaseUrl() {
  return getPublicAppOrigin() || 'http://localhost:3000'
}

export async function unpublish(workspaceId: string, compositionId: string) {
  const prisma = getPrisma()
  await prisma.scriptCompositionPublish.deleteMany({
    where: { compositionId, workspaceId },
  })
}

export async function getPublishBySlug(publicSlug: string) {
  const prisma = getPrisma()
  return prisma.scriptCompositionPublish.findUnique({
    where: { publicSlug },
    include: { composition: { include: { project: true } } },
  })
}

export async function resolveShareLinkById(linkId: string) {
  const prisma = getPrisma()
  return prisma.scriptCompositionShareLink.findFirst({
    where: { id: linkId, revokedAt: null },
    include: { composition: { include: { project: true } } },
  })
}

export async function revokeShareLinks(workspaceId: string, compositionId: string) {
  const prisma = getPrisma()
  await prisma.scriptCompositionShareLink.updateMany({
    where: { compositionId, workspaceId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function removeCollaborator(workspaceId: string, compositionId: string, userId: string) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return false
  const prisma = getPrisma()
  await prisma.scriptCompositionCollaborator.deleteMany({
    where: { compositionId, userId },
  })
  return true
}

export async function incrementPublishViewCount(compositionId: string, viewerLabel?: string) {
  const prisma = getPrisma()
  const pub = await prisma.scriptCompositionPublish.findUnique({ where: { compositionId } })
  if (!pub) return 0
  const settings = (pub.settings ?? {}) as Record<string, unknown>
  const events = Array.isArray(settings.viewEvents) ? [...settings.viewEvents] : []
  events.unshift({
    at: new Date().toISOString(),
    label: viewerLabel?.trim() || 'Viewer',
  })
  const viewEvents = events.slice(0, 50)
  await prisma.scriptCompositionPublish.update({
    where: { id: pub.id },
    data: {
      viewCount: { increment: 1 },
      settings: { ...settings, viewEvents } as Prisma.InputJsonValue,
    },
  })
  const next = await prisma.scriptCompositionPublish.findUnique({ where: { compositionId } })
  return next?.viewCount ?? 0
}

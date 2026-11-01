import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { generateShareToken, hashShareToken } from '@/lib/screenwriting/sharing/token'
import { exportFilename } from '@/lib/server/clips/clips'
import { getRenderForWorkspace } from '@/lib/server/clips/renders'
import { getPublicAppOrigin } from '@/lib/server/public-url'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import {
  buildRenderShareUrls,
  type CreateRenderShareInput,
  type RenderShareLinkDto,
  type UpdateRenderShareInput,
  generateRenderShareSlug,
} from '@/lib/clips/export-share'

export type PublicRenderSharePayload = {
  title: string
  filename: string
  format: string
  resolution: string
  aspectRatio: string
  playbackUrl: string | null
  playbackStatus: 'ready' | 'unavailable'
  allowDownload: boolean
  viewCount: number
  expiresAt: string | null
  sizeBytes: number | null
}

function shareOrigin(): string {
  return getPublicAppOrigin() || 'http://localhost:3000'
}

function toDto(
  row: {
    id: string
    renderId: string
    slug: string
    allowDownload: boolean
    expiresAt: Date | null
    revokedAt: Date | null
    viewCount: number
    createdAt: Date
  },
  accessToken?: string | null,
): RenderShareLinkDto {
  const urls = buildRenderShareUrls(shareOrigin(), row.slug, accessToken)
  return {
    id: row.id,
    renderId: row.renderId,
    slug: row.slug,
    allowDownload: row.allowDownload,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    viewCount: row.viewCount,
    shareUrl: urls.shareUrl,
    pageUrl: urls.pageUrl,
    createdAt: row.createdAt.toISOString(),
  }
}

function linkExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() <= Date.now()
}

async function assertReadyRender(workspaceId: string, renderId: string) {
  const render = await getRenderForWorkspace(workspaceId, renderId)
  if (!render || render.status !== 'READY' || !render.outputKey) {
    return null
  }
  return render
}

export async function getActiveRenderShareLink(workspaceId: string, renderId: string) {
  const prisma = getPrisma()
  return prisma.clipRenderShareLink.findFirst({
    where: { workspaceId, renderId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createRenderShareLink(
  workspaceId: string,
  renderId: string,
  createdById: string,
  input: CreateRenderShareInput = {},
): Promise<{ link: RenderShareLinkDto; accessToken: string } | null> {
  const render = await assertReadyRender(workspaceId, renderId)
  if (!render) return null

  const existing = await getActiveRenderShareLink(workspaceId, renderId)
  if (existing) {
    await revokeRenderShareLink(workspaceId, renderId)
  }

  const prisma = getPrisma()
  const accessToken = generateShareToken()
  const row = await prisma.clipRenderShareLink.create({
    data: {
      id: createId('crs'),
      renderId,
      workspaceId,
      slug: generateRenderShareSlug(),
      tokenHash: hashShareToken(accessToken),
      allowDownload: input.allowDownload ?? true,
      expiresAt: input.expiresAt ?? null,
      createdById,
    },
  })
  return { link: toDto(row, accessToken), accessToken }
}

export async function getRenderShareForWorkspace(
  workspaceId: string,
  renderId: string,
): Promise<RenderShareLinkDto | null> {
  const row = await getActiveRenderShareLink(workspaceId, renderId)
  if (!row || linkExpired(row.expiresAt)) return null
  return toDto(row)
}

export async function updateRenderShareLink(
  workspaceId: string,
  renderId: string,
  input: UpdateRenderShareInput,
): Promise<RenderShareLinkDto | null> {
  const row = await getActiveRenderShareLink(workspaceId, renderId)
  if (!row) return null
  const prisma = getPrisma()
  const updated = await prisma.clipRenderShareLink.update({
    where: { id: row.id },
    data: {
      ...(input.allowDownload !== undefined ? { allowDownload: input.allowDownload } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    },
  })
  return toDto(updated)
}

export async function revokeRenderShareLink(workspaceId: string, renderId: string): Promise<boolean> {
  const prisma = getPrisma()
  const result = await prisma.clipRenderShareLink.updateMany({
    where: { workspaceId, renderId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count > 0
}

async function verifyAccessToken(tokenHash: string, token: string | null): Promise<boolean> {
  if (!token?.trim()) return false
  return hashShareToken(token.trim()) === tokenHash
}

export async function getPublicRenderSharePayload(
  slug: string,
  request?: Request,
): Promise<PublicRenderSharePayload | null> {
  const prisma = getPrisma()
  const row = await prisma.clipRenderShareLink.findFirst({
    where: { slug, revokedAt: null },
    include: {
      render: {
        include: {
          clip: { select: { title: true } },
        },
      },
    },
  })
  if (!row || linkExpired(row.expiresAt)) return null

  const token = request ? new URL(request.url).searchParams.get('t') : null
  if (!(await verifyAccessToken(row.tokenHash, token))) return null

  const render = row.render
  if (render.status !== 'READY' || !render.outputKey) {
    return {
      title: render.clip.title,
      filename: render.filename || exportFilename(render.clip.title),
      format: render.format,
      resolution: render.resolution,
      aspectRatio: render.aspectRatio,
      playbackUrl: null,
      playbackStatus: 'unavailable',
      allowDownload: false,
      viewCount: row.viewCount,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      sizeBytes: render.sizeBytes != null ? Number(render.sizeBytes) : null,
    }
  }

  const storage = getClipStorage()
  const filename = render.filename || exportFilename(render.clip.title)
  let playbackUrl: string | null = null
  if (row.allowDownload) {
    try {
      playbackUrl = await createCachedSignedDownloadUrl(storage, render.outputKey, {
        downloadFilename: filename,
        versionHint: `render-share:${render.id}`,
      })
    } catch {
      playbackUrl = null
    }
  }

  await prisma.clipRenderShareLink.update({
    where: { id: row.id },
    data: { viewCount: { increment: 1 } },
  })

  return {
    title: render.clip.title,
    filename,
    format: render.format,
    resolution: render.resolution,
    aspectRatio: render.aspectRatio,
    playbackUrl,
    playbackStatus: playbackUrl ? 'ready' : 'unavailable',
    allowDownload: row.allowDownload,
    viewCount: row.viewCount + 1,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    sizeBytes: render.sizeBytes != null ? Number(render.sizeBytes) : null,
  }
}

export async function resolveRenderSharePage(slug: string) {
  const prisma = getPrisma()
  return prisma.clipRenderShareLink.findFirst({
    where: { slug, revokedAt: null },
    select: { slug: true, expiresAt: true },
  })
}

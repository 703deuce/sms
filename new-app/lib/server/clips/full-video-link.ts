import 'server-only'

import { isFullVideoSettings } from '@/lib/clips/full-video'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'
import { getPrisma } from '@/lib/server/db'

export type FullVideoLink = {
  projectId: string
  clipId: string
  url: string
  sourceMs: number
}

export async function resolveFullVideoLink(
  workspaceId: string,
  clipId: string,
): Promise<FullVideoLink | null> {
  const prisma = getPrisma()
  const clip = await prisma.clip.findFirst({
    where: { id: clipId, workspaceId, deletedAt: null },
    include: { project: { select: { id: true, uploadId: true, settings: true } } },
  })
  if (!clip?.project?.uploadId) return null

  let fvProjectId: string | null = null
  const parsed = clipProjectSettingsSchema.safeParse(clip.project.settings)
  if (parsed.success && parsed.data.fromFullVideoProjectId) {
    fvProjectId = parsed.data.fromFullVideoProjectId
  }
  if (fvProjectId) {
    const linked = await prisma.clipProject.findFirst({
      where: { id: fvProjectId, workspaceId, deletedAt: null },
      select: { id: true },
    })
    if (!linked) fvProjectId = null
  }
  if (!fvProjectId) {
    const fv = await prisma.clipProject.findFirst({
      where: {
        workspaceId,
        uploadId: clip.project.uploadId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, settings: true },
    })
    if (!fv || !isFullVideoSettings(fv.settings)) return null
    fvProjectId = fv.id
  }

  const fvClip = await prisma.clip.findFirst({
    where: { projectId: fvProjectId, workspaceId, deletedAt: null },
    orderBy: { startMs: 'asc' },
    select: { id: true },
  })
  if (!fvClip) return null

  const sourceMs = clip.startMs
  const url = `/app/clips/${fvProjectId}/edit/${fvClip.id}?t=${sourceMs}`
  return { projectId: fvProjectId, clipId: fvClip.id, url, sourceMs }
}

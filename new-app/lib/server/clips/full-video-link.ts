import 'server-only'

import { isFullVideoSettings } from '@/lib/clips/full-video'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'
import {
  ensureFullVideoProjectForUpload,
  findFullVideoProjectForUpload,
} from '@/lib/server/clips/ensure-full-video-project'
import { getPrisma } from '@/lib/server/db'

export type FullVideoLink = {
  projectId: string
  clipId: string
  url: string
  sourceMs: number
}

export type FullVideoLinkPreparing = {
  preparing: true
  stage: 'project' | 'clip'
  message: string
  projectId?: string
}

export type FullVideoLinkResult = FullVideoLink | FullVideoLinkPreparing | null

export async function resolveFullVideoLink(
  workspaceId: string,
  clipId: string,
): Promise<FullVideoLinkResult | null> {
  const prisma = getPrisma()
  const clip = await prisma.clip.findFirst({
    where: { id: clipId, workspaceId, deletedAt: null },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          uploadId: true,
          settings: true,
          transcriptWords: true,
          proxyKey: true,
          rangeEndMs: true,
        },
      },
    },
  })
  if (!clip?.project?.uploadId) return null

  const upload = await prisma.clipUpload.findFirst({
    where: { id: clip.project.uploadId, workspaceId, status: 'COMPLETE' },
    select: { id: true, durationMs: true, width: true, height: true, filename: true },
  })
  if (!upload) return null

  let fvProjectId: string | null = null
  const parsed = clipProjectSettingsSchema.safeParse(clip.project.settings)
  if (parsed.success && parsed.data.fromFullVideoProjectId) {
    fvProjectId = parsed.data.fromFullVideoProjectId
    const linked = await prisma.clipProject.findFirst({
      where: { id: fvProjectId, workspaceId, deletedAt: null },
      select: { id: true },
    })
    if (!linked) fvProjectId = null
  }
  if (!fvProjectId) {
    const fv = await findFullVideoProjectForUpload(workspaceId, clip.project.uploadId)
    if (fv) fvProjectId = fv.id
  }
  if (!fvProjectId && !isFullVideoSettings(clip.project.settings)) {
    fvProjectId = await ensureFullVideoProjectForUpload(workspaceId, upload, {
      id: clip.project.id,
      title: clip.project.title,
      transcriptWords: clip.project.transcriptWords,
      proxyKey: clip.project.proxyKey,
      rangeEndMs: clip.project.rangeEndMs,
    })
  }
  if (!fvProjectId) return null

  const fvClip = await prisma.clip.findFirst({
    where: { projectId: fvProjectId, workspaceId, deletedAt: null },
    orderBy: { startMs: 'asc' },
    select: { id: true, title: true },
  })
  if (!fvClip) {
    return {
      preparing: true,
      stage: 'clip',
      message: 'Preparing full video editor (rendering clip)…',
      projectId: fvProjectId,
    }
  }

  const sourceMs = clip.startMs
  const momentIn = clip.startMs
  const momentOut = clip.endMs
  const title = encodeURIComponent(clip.title.slice(0, 80))
  const url =
    `/app/video-editor/${fvProjectId}/edit/${fvClip.id}?t=${sourceMs}` +
    `&fromClip=${encodeURIComponent(clipId)}` +
    `&momentIn=${momentIn}&momentOut=${momentOut}&momentTitle=${title}`
  return { projectId: fvProjectId, clipId: fvClip.id, url, sourceMs }
}

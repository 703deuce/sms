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
  const startedAt = Date.now()
  const clip = await prisma.clip.findFirst({
    where: { id: clipId, workspaceId, deletedAt: null },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          uploadId: true,
          settings: true,
          proxyKey: true,
          rangeEndMs: true,
          upload: {
            select: { id: true, durationMs: true, width: true, height: true, filename: true, status: true },
          },
        },
      },
    },
  })
  console.log('[clipper:fullvideo-link] step=source_lookup', { clipId, elapsedMs: Date.now() - startedAt })
  if (!clip?.project?.uploadId) return null
  const upload = clip.project.upload
  if (!upload || upload.status !== 'COMPLETE') return null

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
    const lookupAt = Date.now()
    const fv = await findFullVideoProjectForUpload(workspaceId, clip.project.uploadId)
    console.log('[clipper:fullvideo-link] step=dedupe_lookup', { clipId, elapsedMs: Date.now() - lookupAt, reused: Boolean(fv) })
    if (fv) fvProjectId = fv.id
  }
  if (!fvProjectId && !isFullVideoSettings(clip.project.settings)) {
    const createAt = Date.now()
    const source = await prisma.clipProject.findUnique({
      where: { id: clip.project.id },
      select: { transcriptWords: true },
    })
    console.log('[clipper:fullvideo-link] step=transcript_lookup', {
      clipId, elapsedMs: Date.now() - createAt,
      hasWords: Array.isArray(source?.transcriptWords) && source.transcriptWords.length > 0,
    })
    fvProjectId = await ensureFullVideoProjectForUpload(workspaceId, upload, {
      id: clip.project.id,
      title: clip.project.title,
      transcriptWords: source?.transcriptWords,
      proxyKey: clip.project.proxyKey,
      rangeEndMs: clip.project.rangeEndMs,
    })
    console.log('[clipper:fullvideo-link] step=project_ensure', { clipId, elapsedMs: Date.now() - createAt, projectId: fvProjectId })
  }
  if (!fvProjectId) return null

  const fvClip = await prisma.clip.findFirst({
    where: { projectId: fvProjectId, workspaceId, deletedAt: null },
    orderBy: { startMs: 'asc' },
    select: { id: true, title: true },
  })
  console.log('[clipper:fullvideo-link] step=clip_lookup', { clipId, elapsedMs: Date.now() - startedAt, found: Boolean(fvClip) })
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
  console.log('[clipper:fullvideo-link] step=ready', { clipId, elapsedMs: Date.now() - startedAt, projectId: fvProjectId })
  return { projectId: fvProjectId, clipId: fvClip.id, url, sourceMs }
}

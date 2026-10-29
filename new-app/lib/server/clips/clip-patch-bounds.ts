import type { ClipBounds } from '@/lib/clips/edits'
import { clipTrimLimits } from '@/lib/clips/clip-trim-limits'
import { getPrisma } from '@/lib/server/db'

const uploadDurationCache = new Map<string, number | null>()

export async function clipBoundsForPatch(
  clip: {
    startMs: number
    endMs: number
    projectId: string
    sourceSegKey?: string | null
    sourceSegStartMs?: number | null
    sourceSegEndMs?: number | null
    previewKey?: string | null
  },
): Promise<ClipBounds> {
  const base: ClipBounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
  let uploadDurationMs: number | null = null
  let hasUploadOrProxy = false
  if (!uploadDurationCache.has(clip.projectId)) {
    const prisma = getPrisma()
    const project = await prisma.clipProject.findUnique({
      where: { id: clip.projectId },
      select: { proxyKey: true, upload: { select: { key: true, durationMs: true } } },
    })
    hasUploadOrProxy = Boolean(project?.proxyKey || project?.upload?.key)
    uploadDurationMs =
      project?.upload?.durationMs != null ? Number(project.upload.durationMs) : null
    uploadDurationCache.set(clip.projectId, uploadDurationMs)
  } else {
    uploadDurationMs = uploadDurationCache.get(clip.projectId) ?? null
    hasUploadOrProxy = uploadDurationMs != null || Boolean(clip.sourceSegKey)
  }
  const limits = clipTrimLimits(clip, uploadDurationMs, hasUploadOrProxy)
  if (!limits) return base
  return { ...base, trimMinMs: limits.trimMinMs, trimMaxMs: limits.trimMaxMs }
}

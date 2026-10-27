import { shotsFromCropJson, inferShotsFromWords } from '@/lib/clips/crop-shots'
import { shotsToCropShots, type CropTrack } from '@/lib/clips/crop-track'
import { normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import { normalizeTranscriptJson, resolveEditorWords } from '@/lib/server/clips/editor-words'
import type { SourceWord } from '@/lib/clips/source-words'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveBrollMedia } from '@/lib/server/clips/broll-media'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'

export type CropShot = {
  startMs: number
  endMs: number
  speaker: string
  cx: number
  cy: number
  w: number
  h: number
  scale?: number
}

async function loadProjectTranscript(
  storage: ReturnType<typeof getClipStorage>,
  project: { transcriptKey: string | null; transcriptWords: unknown },
): Promise<ClipWord[]> {
  if (project.transcriptKey) {
    try {
      const raw = await storage.getJson<unknown>(project.transcriptKey)
      const normalized = normalizeTranscriptJson(raw)
      if (normalized.length) return normalized
    } catch {
      /* fall through */
    }
  }
  if (Array.isArray(project.transcriptWords)) {
    const normalized = normalizeTranscriptJson(project.transcriptWords)
    if (normalized.length) return normalized
  }
  return []
}

export async function getClipEditorPayload(workspaceId: string, clipId: string) {
  const clip = await getClipForWorkspace(workspaceId, clipId)
  if (!clip) return null
  const prisma = getPrisma()
  const project = await prisma.clipProject.findUnique({
    where: { id: clip.projectId },
    include: { upload: true },
  })
  if (!project) return null
  const driverHint = clip.storageDriver ?? project.upload?.storageDriver ?? null
  const storage = project.transcriptKey
    ? await getClipStorageForObjectKey(project.transcriptKey, driverHint)
    : getClipStorage(driverHint)
  const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
  const edits = normalizeEdits(clip.edits, bounds)

  const projectTranscript = await loadProjectTranscript(storage, project)
  const words: SourceWord[] = await resolveEditorWords(storage, workspaceId, clip, projectTranscript)

  const cropTrackKey = `ws/${workspaceId}/projects/${clip.projectId}/clips/${clip.id}/crop_track.json`
  let cropTrack: CropTrack | null = null
  try {
    cropTrack = await storage.getJson<CropTrack>(cropTrackKey)
  } catch {
    cropTrack = null
  }

  let cropRaw: unknown = null
  if (clip.cropKey) {
    try {
      cropRaw = await storage.getJson(clip.cropKey)
    } catch {
      cropRaw = null
    }
  }
  let shots: CropShot[] = cropTrack?.shots?.length
    ? shotsToCropShots(cropTrack)
    : shotsFromCropJson(cropRaw as { shots?: CropShot[] }, clip.startMs, clip.endMs)
  if (shots.length <= 1) {
    const inferred = inferShotsFromWords(words, clip.startMs, clip.endMs)
    if (inferred.length > 1) shots = inferred
  }

  const proxyKey = project.proxyKey
  const sourceKey = project.upload?.key
  const brollMedia = edits.broll?.length ? await resolveBrollMedia(edits.broll) : []
  const aiMeta = (clip.aiMeta || null) as { brollIdeas?: string[] } | null

  return {
    clip: {
      id: clip.id,
      projectId: clip.projectId,
      title: clip.title,
      startMs: clip.startMs,
      endMs: clip.endMs,
      score: clip.score,
      durationMs: clip.endMs - clip.startMs,
    },
    bounds,
    edits,
    words,
    crop: { shots, track: cropTrack },
    mediaUrls: {
      preview: clip.previewKey ? await createCachedSignedDownloadUrl(storage, clip.previewKey) : null,
      poster: clip.posterKey ? await createCachedSignedDownloadUrl(storage, clip.posterKey) : null,
      proxy: proxyKey ? await createCachedSignedDownloadUrl(storage, proxyKey) : null,
      source: sourceKey ? await createCachedSignedDownloadUrl(storage, sourceKey) : null,
      cropTrack: cropTrack ? await createCachedSignedDownloadUrl(storage, cropTrackKey) : null,
    },
    project: { id: project.id, title: project.title, settings: project.settings },
    aiMeta,
    brollMedia,
  }
}

export function mergeEditsPatch(
  current: ReturnType<typeof normalizeEdits>,
  patch: unknown,
  bounds: { clipStartMs: number; clipEndMs: number },
) {
  const base = normalizeEdits(current, bounds)
  if (!patch || typeof patch !== 'object') return base
  return normalizeEdits({ ...base, ...(patch as object) }, bounds)
}

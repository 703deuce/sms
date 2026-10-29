import { shotsFromCropJson, inferShotsFromWords } from '@/lib/clips/crop-shots'
import { normalizeCropTrack, shotsToCropShots, type CropTrack } from '@/lib/clips/crop-track'
import { normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import { normalizeTranscriptJson, resolveEditorWords } from '@/lib/server/clips/editor-words'
import type { SourceWord } from '@/lib/clips/source-words'
import { clipperCapabilities } from '@/lib/server/clips/clipper-capabilities'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveBrollMedia } from '@/lib/server/clips/broll-media'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { layersFromLegacy } from '@/lib/clips/layers'

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

export type EditorMedia = {
  url: string
  kind: 'proxy' | 'source' | 'segment' | 'composite'
  offsetMs: number
  minMs?: number
  maxMs?: number
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

export async function getClipEditorWords(workspaceId: string, clipId: string) {
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
  const projectTranscript = await loadProjectTranscript(storage, project)
  const words = await resolveEditorWords(storage, workspaceId, clip, projectTranscript)
  return { words, bounds: { clipStartMs: clip.startMs, clipEndMs: clip.endMs } }
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
    const rawTrack = await storage.getJson<unknown>(cropTrackKey)
    cropTrack = normalizeCropTrack(rawTrack)
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
  const previewKey = clip.previewKey
  const sourceSegKey = clip.sourceSegKey
  const sourceSegStartMs = clip.sourceSegStartMs
  const sourceSegEndMs = clip.sourceSegEndMs

  const segmentExists =
    Boolean(sourceSegKey) &&
    sourceSegStartMs != null &&
    (await storage.getObjectSizeBytes(sourceSegKey)) != null

  let media: EditorMedia | null = null
  if (proxyKey) {
    media = {
      url: await createCachedSignedDownloadUrl(storage, proxyKey),
      kind: 'proxy',
      offsetMs: 0,
    }
  } else if (sourceKey) {
    media = {
      url: await createCachedSignedDownloadUrl(storage, sourceKey),
      kind: 'source',
      offsetMs: 0,
    }
  } else if (segmentExists && sourceSegKey) {
    media = {
      url: await createCachedSignedDownloadUrl(storage, sourceSegKey),
      kind: 'segment',
      offsetMs: sourceSegStartMs,
      minMs: sourceSegStartMs,
      maxMs: sourceSegEndMs ?? undefined,
    }
  } else if (previewKey) {
    media = {
      url: await createCachedSignedDownloadUrl(storage, previewKey),
      kind: 'composite',
      offsetMs: clip.startMs,
      minMs: clip.startMs,
      maxMs: clip.endMs,
    }
  }

  const brollMedia = edits.broll?.length ? await resolveBrollMedia(edits.broll) : []
  const aiMeta = (clip.aiMeta || null) as { brollIdeas?: string[] } | null

  const streamVod = await prisma.streamVod.findUnique({
    where: { projectId: project.id },
    select: { chatSource: true, chatMessages: true, sourceType: true, state: true },
  })
  const vodState =
    streamVod?.state && typeof streamVod.state === 'object' && !Array.isArray(streamVod.state)
      ? (streamVod.state as Record<string, unknown>)
      : null
  const vodChatMeta =
    vodState?.chatMeta && typeof vodState.chatMeta === 'object' && !Array.isArray(vodState.chatMeta)
      ? (vodState.chatMeta as {
          available?: boolean
          messageCount?: number
          source?: string | null
          error?: string | null
        })
      : null

  return {
    clip: {
      id: clip.id,
      projectId: clip.projectId,
      title: clip.title,
      startMs: clip.startMs,
      endMs: clip.endMs,
      score: clip.score,
      durationMs: clip.endMs - clip.startMs,
      updatedAt: clip.updatedAt.toISOString(),
      editsSaveVersion: clip.editsSaveVersion,
    },
    bounds,
    edits,
    layers: layersFromLegacy(edits),
    words,
    crop: { shots, track: cropTrack },
    mediaUrls: {
      preview: previewKey ? await createCachedSignedDownloadUrl(storage, previewKey) : null,
      poster: clip.posterKey ? await createCachedSignedDownloadUrl(storage, clip.posterKey) : null,
      proxy: proxyKey ? await createCachedSignedDownloadUrl(storage, proxyKey) : null,
      source: sourceKey ? await createCachedSignedDownloadUrl(storage, sourceKey) : null,
      cropTrack: cropTrack ? await createCachedSignedDownloadUrl(storage, cropTrackKey) : null,
    },
    media,
    project: { id: project.id, title: project.title, settings: project.settings, status: project.status },
    vodChat: streamVod
      ? {
          chatSource: streamVod.chatSource,
          chatMessages: streamVod.chatMessages,
          sourceType: streamVod.sourceType,
          chatError: typeof vodState?.chatError === 'string' ? vodState.chatError : null,
          chatMeta: vodChatMeta,
        }
      : null,
    capabilities: clipperCapabilities(),
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

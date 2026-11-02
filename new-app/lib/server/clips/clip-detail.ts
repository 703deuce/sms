import { shotsFromCropJson, inferShotsFromWords } from '@/lib/clips/crop-shots'
import { normalizeCropTrack, shotsToCropShots, type CropTrack } from '@/lib/clips/crop-track'
import { mergeEditsPatch, normalizeEdits, type ClipBounds, type ClipWord } from '@/lib/clips/edits'
import { normalizeTranscriptJson, preloadClipWordJson, resolveEditorWords } from '@/lib/server/clips/editor-words'
import { clipperCapabilities } from '@/lib/server/clips/clipper-capabilities'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveBrollMedia } from '@/lib/server/clips/broll-media'
import { resolveEditorAssets } from '@/lib/server/clips/editor-assets'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { CLIPS_EDITOR_MEDIA_TTL_SEC, createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { resolveLayers } from '@/lib/clips/layers'
import { clipBoundsForPatch } from '@/lib/server/clips/clip-patch-bounds'
import {
  resolveEditorClipMedia,
  streamerPrefersClipSegmentMedia,
} from '@/lib/server/clips/editor-clip-media'

export type FacecamLayoutState = {
  layout?: string
  facecam?: { x: number; y: number; w: number; h: number } | null
  gameplay?: { x: number; y: number; w: number; h: number } | null
  split?: number
  facecamPosition?: 'top' | 'bottom'
  confidence?: number
  source?: string
}

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

const TRANSCRIPT_CACHE_MAX = 50
const projectTranscriptCache = new Map<string, ClipWord[]>()

function transcriptCacheKey(transcriptKey: string, updatedAt: Date): string {
  return `${transcriptKey}:${updatedAt.toISOString()}`
}

/** Test hook. */
export function __resetProjectTranscriptCache(): void {
  projectTranscriptCache.clear()
}

async function loadProjectTranscript(
  storage: ReturnType<typeof getClipStorage>,
  project: { transcriptKey: string | null; updatedAt: Date },
): Promise<ClipWord[]> {
  if (!project.transcriptKey) return []
  const cacheKey = transcriptCacheKey(project.transcriptKey, project.updatedAt)
  const hit = projectTranscriptCache.get(cacheKey)
  if (hit) return hit
  try {
    const raw = await storage.getJson<unknown>(project.transcriptKey)
    const normalized = normalizeTranscriptJson(raw)
    if (normalized.length) {
      if (projectTranscriptCache.size >= TRANSCRIPT_CACHE_MAX) {
        const first = projectTranscriptCache.keys().next().value
        if (first) projectTranscriptCache.delete(first)
      }
      projectTranscriptCache.set(cacheKey, normalized)
      return normalized
    }
  } catch {
    /* fall through */
  }
  return []
}

export async function getClipEditorWords(
  workspaceId: string,
  clipId: string,
  opts?: { trimInMs?: number; trimOutMs?: number; contextMs?: number },
) {
  const clip = await getClipForWorkspace(workspaceId, clipId)
  if (!clip) return null
  const prisma = getPrisma()
  const project = await prisma.clipProject.findUnique({
    where: { id: clip.projectId },
    select: { transcriptKey: true, updatedAt: true, upload: { select: { storageDriver: true } } },
  })
  if (!project) return null
  const driverHint = clip.storageDriver ?? project.upload?.storageDriver ?? null
  const storage = project.transcriptKey
    ? driverHint
      ? getClipStorage(driverHint)
      : await getClipStorageForObjectKey(project.transcriptKey, driverHint)
    : getClipStorage(driverHint)
  const projectTranscript = await loadProjectTranscript(storage, project)
  const bounds = await clipBoundsForPatch({
    startMs: clip.startMs,
    endMs: clip.endMs,
    projectId: clip.projectId,
    sourceSegKey: clip.sourceSegKey,
    sourceSegStartMs: clip.sourceSegStartMs,
    sourceSegEndMs: clip.sourceSegEndMs,
    previewKey: clip.previewKey,
  })
  const trimLimits =
    bounds.trimMinMs != null && bounds.trimMaxMs != null
      ? { minMs: bounds.trimMinMs, maxMs: bounds.trimMaxMs }
      : undefined
  const words = await resolveEditorWords(storage, workspaceId, clip, projectTranscript, {
    trimInMs: opts?.trimInMs,
    trimOutMs: opts?.trimOutMs,
    contextMs: opts?.contextMs,
    trimLimits,
  })
  return { words, bounds: { clipStartMs: clip.startMs, clipEndMs: clip.endMs, ...bounds } }
}

export async function getClipEditorPayload(workspaceId: string, clipId: string) {
  const detailStartedAt = Date.now()
  const prisma = getPrisma()
  const row = await prisma.clip.findFirst({
    where: { id: clipId, workspaceId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      title: true,
      startMs: true,
      endMs: true,
      score: true,
      updatedAt: true,
      editsSaveVersion: true,
      edits: true,
      previewKey: true,
      posterKey: true,
      cropKey: true,
      sourceSegKey: true,
      sourceSegStartMs: true,
      sourceSegEndMs: true,
      storageDriver: true,
      aiMeta: true,
      wordsKey: true,
      project: {
        select: {
          id: true,
          title: true,
          settings: true,
          status: true,
          transcriptKey: true,
          proxyKey: true,
          updatedAt: true,
          upload: { select: { key: true, storageDriver: true } },
        },
      },
    },
  })
  if (!row) return null
  const clip = row
  const project = row.project
  const driverHint = clip.storageDriver ?? project.upload?.storageDriver ?? null
  const storage = project.transcriptKey
    ? driverHint
      ? getClipStorage(driverHint)
      : await getClipStorageForObjectKey(project.transcriptKey, driverHint)
    : getClipStorage(driverHint)

  const clipVersionHint = clip.updatedAt.toISOString()
  const projectVersionHint = project.updatedAt.toISOString()
  const signClip = { versionHint: clipVersionHint }
  const signProject = { versionHint: projectVersionHint }

  const cropTrackKey = `ws/${workspaceId}/projects/${clip.projectId}/clips/${clip.id}/crop_track.json`
  const proxyKey = project.proxyKey
  const sourceKey = project.upload?.key
  const previewKey = clip.previewKey
  const sourceSegKey = clip.sourceSegKey
  const sourceSegStartMs = clip.sourceSegStartMs
  const sourceSegEndMs = clip.sourceSegEndMs

  const boundsP = clipBoundsForPatch({
    startMs: clip.startMs,
    endMs: clip.endMs,
    projectId: clip.projectId,
    sourceSegKey: clip.sourceSegKey,
    sourceSegStartMs: clip.sourceSegStartMs,
    sourceSegEndMs: clip.sourceSegEndMs,
    previewKey: clip.previewKey,
  })
  const projectTranscriptP = loadProjectTranscript(storage, project)
  const clipWordsP = preloadClipWordJson(storage, workspaceId, clip)
  const cropTrackJsonP = storage.getJson<unknown>(cropTrackKey).catch(() => null)
  const cropRawP = clip.cropKey ? storage.getJson(clip.cropKey).catch(() => null) : Promise.resolve(null)
  const segmentSizeP = sourceSegKey
    ? storage.getObjectSizeBytes(sourceSegKey).catch(() => null)
    : Promise.resolve(null)
  const uploadSourceSizeP =
    sourceSegKey && sourceKey
      ? storage.getObjectSizeBytes(sourceKey).catch(() => null)
      : Promise.resolve(null)

  const [
    bounds,
    projectTranscript,
    cropTrackResult,
    cropRawResult,
    segmentSize,
    uploadSourceSize,
    streamVod,
    signedPreview,
    signedPoster,
    signedProxy,
    signedSource,
    words,
    signedCropTrack,
    brollMedia,
    editorAssets,
    signedSourceSeg,
  ] = await Promise.all([
    boundsP,
    projectTranscriptP,
    cropTrackJsonP,
    cropRawP,
    segmentSizeP,
    uploadSourceSizeP,
    prisma.streamVod.findUnique({
      where: { projectId: project.id },
      select: { chatSource: true, chatMessages: true, sourceType: true, state: true, channelId: true },
    }),
    previewKey
      ? createCachedSignedDownloadUrl(storage, previewKey, signClip, CLIPS_EDITOR_MEDIA_TTL_SEC).catch(() => null)
      : Promise.resolve(null),
    clip.posterKey
      ? createCachedSignedDownloadUrl(storage, clip.posterKey, signClip, CLIPS_EDITOR_MEDIA_TTL_SEC).catch(() => null)
      : Promise.resolve(null),
    proxyKey
      ? createCachedSignedDownloadUrl(storage, proxyKey, signProject, CLIPS_EDITOR_MEDIA_TTL_SEC).catch(() => null)
      : Promise.resolve(null),
    sourceKey
      ? createCachedSignedDownloadUrl(storage, sourceKey, signProject, CLIPS_EDITOR_MEDIA_TTL_SEC).catch(() => null)
      : Promise.resolve(null),
    Promise.all([projectTranscriptP, clipWordsP]).then(([pt, clipWords]) =>
      resolveEditorWords(storage, workspaceId, clip, pt, { preloadedClipWords: clipWords }),
    ),
    cropTrackJsonP.then((track) =>
      track
        ? createCachedSignedDownloadUrl(storage, cropTrackKey, signClip, CLIPS_EDITOR_MEDIA_TTL_SEC).catch(() => null)
        : Promise.resolve(null),
    ),
    boundsP.then((b) => {
      const edits = normalizeEdits(clip.edits, b)
      return edits.broll?.length ? resolveBrollMedia(edits.broll) : Promise.resolve([])
    }),
    resolveEditorAssets(storage, clip.aiMeta, clipVersionHint),
    Promise.all([segmentSizeP]).then(([size]) => {
      const segmentExists =
        Boolean(sourceSegKey) && sourceSegStartMs != null && size != null
      if (!segmentExists || !sourceSegKey) return Promise.resolve(null)
      return createCachedSignedDownloadUrl(storage, sourceSegKey, signClip, CLIPS_EDITOR_MEDIA_TTL_SEC).catch(
        () => null,
      )
    }),
  ])

  const edits = normalizeEdits(clip.edits, bounds)

  const clipStartMs = clip.startMs
  const clipEndMs = clip.endMs
  const detailBounds = bounds

  let cropTrack: CropTrack | null = null
  if (cropTrackResult) {
    cropTrack = normalizeCropTrack(cropTrackResult)
  }

  let shots: CropShot[] = cropTrack?.shots?.length
    ? shotsToCropShots(cropTrack)
    : shotsFromCropJson(cropRawResult as { shots?: CropShot[] }, clipStartMs, clipEndMs)
  if (shots.length <= 1) {
    const inferred = inferShotsFromWords(words, clipStartMs, clipEndMs)
    if (inferred.length > 1) shots = inferred
  }

  const segmentExists =
    Boolean(sourceSegKey) && sourceSegStartMs != null && segmentSize != null

  const vodState =
    streamVod?.state && typeof streamVod.state === 'object' && !Array.isArray(streamVod.state)
      ? (streamVod.state as Record<string, unknown>)
      : null
  const bulkyStoragePurged = vodState?.bulkyStoragePurged === true
  const preferClipSegment = streamerPrefersClipSegmentMedia({
    hasStreamVod: Boolean(streamVod),
    bulkyStoragePurged,
    proxyKey,
    sourceSegKey,
  })
  const uploadSourcePresent =
    preferClipSegment || Boolean(streamVod)
      ? uploadSourceSize != null && uploadSourceSize > 0
      : true

  const media = resolveEditorClipMedia({
    proxyKey,
    signedProxy,
    sourceKey: sourceKey ?? null,
    signedSource,
    uploadSourcePresent,
    preferClipSegment,
    segmentExists,
    signedSourceSeg,
    sourceSegStartMs,
    sourceSegEndMs,
    previewKey,
    signedPreview,
    clipStartMs,
    clipEndMs,
  })

  const aiMeta = (clip.aiMeta || null) as { brollIdeas?: string[] } | null

  const vodChatMeta =
    vodState?.chatMeta && typeof vodState.chatMeta === 'object' && !Array.isArray(vodState.chatMeta)
      ? (vodState.chatMeta as {
          available?: boolean
          messageCount?: number
          source?: string | null
          error?: string | null
        })
      : null

  const vodLayoutRaw = vodState?.layout
  const aiFc = (clip.aiMeta as { facecamLayout?: FacecamLayoutState } | null)?.facecamLayout
  const facecamLayout: FacecamLayoutState | null =
    vodLayoutRaw && typeof vodLayoutRaw === 'object' && !Array.isArray(vodLayoutRaw)
      ? (vodLayoutRaw as FacecamLayoutState)
      : aiFc?.facecam
        ? aiFc
        : null

  const payload = {
    clip: {
      id: clip.id,
      projectId: clip.projectId,
      title: clip.title,
      startMs: clipStartMs,
      endMs: clipEndMs,
      score: clip.score,
      durationMs: clipEndMs - clipStartMs,
      updatedAt: clip.updatedAt.toISOString(),
      editsSaveVersion: clip.editsSaveVersion,
    },
    bounds: detailBounds,
    edits,
    layers: resolveLayers(edits),
    facecamLayout,
    words,
    crop: { shots, track: cropTrack },
    mediaUrls: {
      preview: signedPreview,
      poster: signedPoster,
      proxy: signedProxy,
      source: preferClipSegment && segmentExists ? null : signedSource,
      segment: signedSourceSeg,
      cropTrack: signedCropTrack,
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
    editorAssets,
    streamChannelId: streamVod?.channelId ?? null,
    sourceSegStartMs,
    sourceSegEndMs,
  }
  console.info('[clipper:detail] ms', { clipId, total: Date.now() - detailStartedAt })
  return payload
}

export { mergeEditsPatch, editsPayloadForSave } from '@/lib/clips/edits'

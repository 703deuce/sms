import { shotsFromCropJson, inferShotsFromWords } from '@/lib/clips/crop-shots'
import { normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import { loadSourceWords, type SourceWord } from '@/lib/clips/source-words'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'

const SIGNED_TTL = 3600

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
      return await storage.getJson<ClipWord[]>(project.transcriptKey)
    } catch {
      /* fall through */
    }
  }
  if (Array.isArray(project.transcriptWords)) {
    return project.transcriptWords as ClipWord[]
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
  const storage = getClipStorage()
  const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
  const edits = normalizeEdits(clip.edits, bounds)

  let transcript = await loadProjectTranscript(storage, project)
  if (!transcript.length && clip.wordsKey) {
    try {
      const clipWords = await storage.getJson<ClipWord[]>(clip.wordsKey)
      transcript = clipWords.map((w) => ({
        ...w,
        s: w.s + clip.startMs / 1000,
        e: w.e + clip.startMs / 1000,
      }))
    } catch {
      transcript = []
    }
  }

  const words: SourceWord[] = loadSourceWords(transcript)

  let cropRaw: unknown = null
  if (clip.cropKey) {
    try {
      cropRaw = await storage.getJson(clip.cropKey)
    } catch {
      cropRaw = null
    }
  }
  let shots = shotsFromCropJson(cropRaw as { shots?: CropShot[] }, clip.startMs, clip.endMs)
  if (shots.length <= 1) {
    const inferred = inferShotsFromWords(words, clip.startMs, clip.endMs)
    if (inferred.length > 1) shots = inferred
  }

  const proxyKey = project.proxyKey
  const sourceKey = project.upload?.key
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
    crop: { shots },
    mediaUrls: {
      preview: clip.previewKey ? await storage.createSignedDownloadUrl(clip.previewKey, SIGNED_TTL) : null,
      poster: clip.posterKey ? await storage.createSignedDownloadUrl(clip.posterKey, SIGNED_TTL) : null,
      proxy: proxyKey ? await storage.createSignedDownloadUrl(proxyKey, SIGNED_TTL) : null,
      source: sourceKey ? await storage.createSignedDownloadUrl(sourceKey, SIGNED_TTL) : null,
    },
    project: { id: project.id, title: project.title, settings: project.settings },
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

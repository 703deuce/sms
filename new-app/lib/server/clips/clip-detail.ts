import { defaultEdits, normalizeEdits, type ClipWord } from '@/lib/clips/edits'
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
  const durationMs = clip.endMs - clip.startMs
  const edits = normalizeEdits(clip.edits, durationMs)
  let words: ClipWord[] = []
  if (clip.wordsKey) {
    try {
      words = await storage.getJson<ClipWord[]>(clip.wordsKey)
    } catch {
      words = []
    }
  }
  let crop: { shots: CropShot[] } = { shots: [] }
  if (clip.cropKey) {
    try {
      crop = await storage.getJson<{ shots: CropShot[] }>(clip.cropKey)
    } catch {
      crop = { shots: [] }
    }
  }
  if (!crop.shots?.length) {
    crop = {
      shots: [
        {
          startMs: 0,
          endMs: durationMs,
          speaker: 'A',
          cx: 50,
          cy: 45,
          w: 100,
          h: 100,
          scale: 1.15,
        },
      ],
    }
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
      durationMs,
    },
    edits,
    words,
    crop,
    mediaUrls: {
      preview: clip.previewKey ? await storage.createSignedDownloadUrl(clip.previewKey, SIGNED_TTL) : null,
      poster: clip.posterKey ? await storage.createSignedDownloadUrl(clip.posterKey, SIGNED_TTL) : null,
      proxy: proxyKey ? await storage.createSignedDownloadUrl(proxyKey, SIGNED_TTL) : null,
      source: sourceKey ? await storage.createSignedDownloadUrl(sourceKey, SIGNED_TTL) : null,
    },
    project: { id: project.id, title: project.title, settings: project.settings },
  }
}

export function mergeEditsPatch(current: ReturnType<typeof normalizeEdits>, patch: unknown, durationMs: number) {
  const base = normalizeEdits(current, durationMs)
  if (!patch || typeof patch !== 'object') return base
  return normalizeEdits({ ...base, ...(patch as object) }, durationMs)
}

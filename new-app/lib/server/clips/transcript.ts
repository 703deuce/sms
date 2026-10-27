import type { ClipWord } from '@/lib/clips/edits'
import { loadSourceWords, type SourceWord } from '@/lib/clips/source-words'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'

export async function loadProjectSourceWords(projectId: string): Promise<SourceWord[]> {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findUnique({ where: { id: projectId } })
  if (!project) return []
  let raw: ClipWord[] = []
  if (project.transcriptKey) {
    try {
      const storage = await getClipStorageForObjectKey(project.transcriptKey)
      raw = await storage.getJson<ClipWord[]>(project.transcriptKey)
    } catch {
      raw = []
    }
  }
  if (!raw.length && Array.isArray(project.transcriptWords)) {
    raw = project.transcriptWords as ClipWord[]
  }
  return loadSourceWords(raw)
}

export async function loadClipSourceWords(clip: {
  startMs: number
  wordsKey: string | null
  projectId: string
}): Promise<SourceWord[]> {
  const all = await loadProjectSourceWords(clip.projectId)
  if (all.length) return all
  if (!clip.wordsKey) return []
  try {
    const storage = await getClipStorageForObjectKey(clip.wordsKey)
    const clipWords = await storage.getJson<ClipWord[]>(clip.wordsKey)
    const shifted = clipWords.map((w) => ({
      ...w,
      s: w.s + clip.startMs / 1000,
      e: w.e + clip.startMs / 1000,
    }))
    return loadSourceWords(shifted)
  } catch {
    return []
  }
}

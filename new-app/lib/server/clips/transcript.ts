import type { ClipWord } from '@/lib/clips/edits'
import { loadSourceWords, type SourceWord } from '@/lib/clips/source-words'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'

export async function loadProjectSourceWords(projectId: string): Promise<SourceWord[]> {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findUnique({ where: { id: projectId } })
  if (!project) return []
  const storage = getClipStorage()
  let raw: ClipWord[] = []
  if (project.transcriptKey) {
    try {
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
  id?: string
  startMs: number
  endMs: number
  wordsKey: string | null
  projectId: string
  workspaceId?: string
}): Promise<SourceWord[]> {
  const storage = getClipStorage()
  const clipKeys = [
    clip.wordsKey,
    clip.id && clip.workspaceId
      ? `ws/${clip.workspaceId}/projects/${clip.projectId}/clips/${clip.id}/words.json`
      : null,
  ].filter(Boolean) as string[]
  for (const key of clipKeys) {
    try {
      const clipWords = await storage.getJson<ClipWord[]>(key)
      const shifted = clipWords.map((w) => ({
        ...w,
        s: w.s + clip.startMs / 1000,
        e: w.e + clip.startMs / 1000,
      }))
      const loaded = loadSourceWords(shifted)
      if (loaded.length) return loaded
    } catch {
      /* try next key */
    }
  }
  const all = await loadProjectSourceWords(clip.projectId)
  if (all.length) return all
  return []
}

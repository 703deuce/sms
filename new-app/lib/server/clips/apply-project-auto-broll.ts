import 'server-only'

import { normalizeEdits } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'
import { mergeAutoBrollItems } from '@/lib/clips/broll-auto-utils'
import { buildAutoBrollItems } from '@/lib/server/clips/broll-auto'
import { getPrisma } from '@/lib/server/db'
import { getClipStorageForObjectKey } from '@/lib/storage'

export type ApplyProjectAutoBrollResult = {
  clipsProcessed: number
  clipsUpdated: number
  placements: number
}

export async function applyProjectAutoStockBroll(
  workspaceId: string,
  projectId: string,
): Promise<ApplyProjectAutoBrollResult> {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
  })
  if (!project) throw new Error('Project not found')
  const settings = (project.settings ?? {}) as Record<string, unknown>
  if (!settings.autoStockBroll) {
    return { clipsProcessed: 0, clipsUpdated: 0, placements: 0 }
  }

  const clips = await prisma.clip.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { score: 'desc' },
  })
  let transcript: { w: string; s: number; e: number; i?: number }[] = []
  if (project.transcriptKey) {
    try {
      const storage = await getClipStorageForObjectKey(project.transcriptKey)
      transcript = await storage.getJson(project.transcriptKey)
    } catch {
      transcript = []
    }
  }
  const sourceWords = loadSourceWords(transcript)

  let clipsUpdated = 0
  let placements = 0
  for (const clip of clips) {
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    if ((edits.broll?.length ?? 0) > 0) continue
    const { items } = await buildAutoBrollItems(edits, sourceWords, { clipTitle: clip.title })
    if (!items.length) continue
    const merged = mergeAutoBrollItems(edits.broll || [], items)
    await prisma.clip.update({
      where: { id: clip.id },
      data: { edits: { ...edits, broll: merged } as object },
    })
    clipsUpdated += 1
    placements += items.length
  }

  console.info('[clipper:broll] project auto-stock complete', {
    projectId,
    clipsProcessed: clips.length,
    clipsUpdated,
    placements,
  })
  return { clipsProcessed: clips.length, clipsUpdated, placements }
}

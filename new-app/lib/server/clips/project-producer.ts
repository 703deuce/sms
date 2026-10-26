import 'server-only'

import type { ProducerToolCall } from '@/lib/clips/edits-reducer'
import { canonicalEditsJson, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { getPrisma } from '@/lib/server/db'
import { loadClipWords, runProducerOnClip } from '@/lib/server/clips/producer-run'

export type ProjectProducerAction = { clipId: string; tools: ProducerToolCall[] }

export type ClipProducerResult = {
  clipId: string
  title: string
  before: ClipEditsV2
  after: ClipEditsV2
  changeCount: number
  summaries: string[]
}

export async function applyProjectProducerActions(
  workspaceId: string,
  projectId: string,
  actions: ProjectProducerAction[],
  transcriptWordsByProject: unknown,
): Promise<ClipProducerResult[]> {
  const prisma = getPrisma()
  const clips = await prisma.clip.findMany({
    where: { projectId, workspaceId, deletedAt: null },
  })
  const byId = new Map(clips.map((c) => [c.id, c]))
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  const transcriptWords = project?.transcriptWords ?? transcriptWordsByProject

  const results: ClipProducerResult[] = []
  for (const action of actions) {
    const clip = byId.get(action.clipId)
    if (!clip || !action.tools?.length) continue
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const before = normalizeEdits(clip.edits, bounds)
    const words = await loadClipWords(workspaceId, projectId, clip.id, transcriptWords)
    const applied = runProducerOnClip(before, bounds, action.tools, words)
    if (canonicalEditsJson(before) === canonicalEditsJson(applied.edits) && applied.changeCount === 0) continue
    await prisma.clip.update({
      where: { id: clip.id },
      data: { edits: applied.edits as object },
    })
    results.push({
      clipId: clip.id,
      title: clip.title,
      before,
      after: applied.edits,
      changeCount: applied.changeCount,
      summaries: applied.summaries,
    })
  }
  return results
}

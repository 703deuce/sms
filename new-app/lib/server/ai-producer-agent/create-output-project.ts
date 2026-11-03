import 'server-only'

import { duplicateClipProjects } from '@/lib/server/clips/drive-projects'
import { getPrisma } from '@/lib/server/db'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'
import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import type { AiProducerSourceRef } from '@/lib/ai-producer-agent/types'

export async function createAiProducerOutputProject(
  workspaceId: string,
  sources: AiProducerSourceRef[],
  edits: ClipEditsV2,
  title: string,
): Promise<{ projectId: string; clipId: string }> {
  const primary = sources[0]
  if (!primary?.projectId) throw new Error('source_project_required')
  const [newProjectId] = await duplicateClipProjects(workspaceId, [primary.projectId])
  if (!newProjectId) throw new Error('duplicate_failed')
  await getPrisma().clipProject.update({
    where: { id: newProjectId },
    data: { title, status: 'READY', stage: 'ready', progress: 100 },
  })
  const clip = await getPrisma().clip.findFirst({
    where: { projectId: newProjectId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  if (!clip) throw new Error('clip_missing')
  const bounds: ClipBounds = {
    clipStartMs: clip.startMs,
    clipEndMs: clip.endMs,
    trimMinMs: 0,
    trimMaxMs: Math.max(clip.endMs, clip.startMs + 1000),
  }
  await writeClipEditsOrThrow(clip.id, bounds, clip.editsSaveVersion, () => edits)
  return { projectId: newProjectId, clipId: clip.id }
}

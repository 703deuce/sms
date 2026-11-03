import 'server-only'

import { getPrisma } from '@/lib/server/db'
import type { AiProducerSourceRef } from '@/lib/ai-producer-agent/types'

export async function resolveAiProducerSources(workspaceId: string, sources: AiProducerSourceRef[]): Promise<AiProducerSourceRef[]> {
  const prisma = getPrisma()
  const out: AiProducerSourceRef[] = []
  for (const src of sources) {
    if (src.storageKey) {
      out.push(src)
      continue
    }
    if (src.clipId) {
      const clip = await prisma.clip.findFirst({
        where: { id: src.clipId, workspaceId, deletedAt: null },
        include: { project: { include: { upload: true } } },
      })
      if (!clip?.project?.upload) throw new Error('clip_source_missing')
      out.push({
        ...src,
        projectId: clip.projectId,
        storageKey: clip.project.upload.key,
        rangeMs: [clip.startMs, clip.endMs],
        durationMs: clip.endMs - clip.startMs,
        title: clip.title,
      })
      continue
    }
    if (src.projectId) {
      const project = await prisma.clipProject.findFirst({
        where: { id: src.projectId, workspaceId, deletedAt: null },
        include: { upload: true },
      })
      if (!project?.upload) throw new Error('project_source_missing')
      out.push({
        ...src,
        storageKey: project.upload.key,
        rangeMs: [project.rangeStartMs, project.rangeEndMs],
        durationMs: project.rangeEndMs - project.rangeStartMs,
        title: project.title,
      })
      continue
    }
    throw new Error('source_ref_incomplete')
  }
  return out
}

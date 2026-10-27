import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { createClipProjectFromPrompt } from '@/lib/server/clips/projects' // REUSE: creates DRAFT ClipProject + transcriptKey
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { ttsHash } from '@/lib/server/ai/elevenlabs-tts'

export class RevisionConflict extends Error { constructor() { super('revision_conflict') } }

export async function createT2vDraft(workspaceId: string, doc: T2vDraftV1) {
  const prisma = getPrisma()
  const project = await createClipProjectFromPrompt(workspaceId, { prompt: (doc.source.prompt ?? doc.source.script ?? doc.source.url ?? doc.title).slice(0, 2000) || 'Text to video', title: doc.title })
  await prisma.clipProject.update({ where: { id: project.id }, data: { sourceKind: 't2v' } })
  return prisma.t2vDraft.create({ data: { id: createId('t2v'), workspaceId, projectId: project.id, document: doc as never } })
}

/** Optimistic concurrency, same contract as composition PATCH (409 on stale revision). */
export async function saveT2vDraft(workspaceId: string, id: string, baseRevision: number, doc: T2vDraftV1) {
  // keep voice hashes current so the worker never recomputes them
  for (const s of doc.scenes) {
    const h = ttsHash(s.narration, doc.voice)
    if (s.voice?.hash !== h) s.voice = { ...s.voice, hash: h, status: 'stale' }
  }
  const res = await getPrisma().t2vDraft.updateMany({
    where: { id, workspaceId, revision: baseRevision },
    data: { document: doc as never, revision: { increment: 1 } },
  })
  if (res.count === 0) throw new RevisionConflict()
  return { revision: baseRevision + 1, document: doc }
}

export async function enqueueT2vAssemble(workspaceId: string, draftId: string) {
  const prisma = getPrisma()
  const d = await prisma.t2vDraft.findFirstOrThrow({ where: { id: draftId, workspaceId } })
  const jobId = createId('job')
  await prisma.$transaction([
    prisma.clipJob.create({ data: { id: jobId, projectId: d.projectId, type: 'T2V_ASSEMBLE', status: 'QUEUED',
      payload: { draftId, projectId: d.projectId, workspaceId, revision: d.revision } } }),
    prisma.t2vDraft.update({ where: { id: draftId }, data: { status: 'ASSEMBLING', stage: 'queued', progress: 0, error: null } }),
  ])
  return { jobId }
}

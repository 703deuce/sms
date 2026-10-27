import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import type { T2vExtractDeckJobPayload } from '@/lib/t2v/m9-contracts'

/** Enqueue T2V_EXTRACT_DECK for Agent B worker (python-pptx / pypdf). */
export async function enqueueT2vExtractDeck(workspaceId: string, input: { uploadId: string; draftId?: string; projectId?: string }) {
  const prisma = getPrisma()
  const upload = await prisma.clipUpload.findFirst({
    where: { id: input.uploadId, workspaceId, status: 'COMPLETE' },
  })
  if (!upload) throw new Error('upload_not_ready')

  const projectId =
    input.projectId ??
    (input.draftId
      ? (await prisma.t2vDraft.findFirst({ where: { id: input.draftId, workspaceId }, select: { projectId: true } }))?.projectId
      : null)
  if (!projectId) throw new Error('project_required')

  const payload: T2vExtractDeckJobPayload = {
    workspaceId,
    uploadId: input.uploadId,
    draftId: input.draftId,
  }
  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId,
      type: 'T2V_EXTRACT_DECK',
      status: 'QUEUED',
      payload,
    },
  })
  return { jobId, status: 'queued' as const }
}

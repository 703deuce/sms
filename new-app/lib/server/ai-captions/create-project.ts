import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { projectWordsKey } from '@/lib/storage'
import { AiCaptionsError } from '@/lib/ai-captions/errors'
import { captionsOnlyProjectSettings } from '@/lib/ai-captions/auto-agent-guard'

/**
 * Create a captions-only project from a completed upload.
 * Transcription only: enqueue PROCESS_PROJECT with agentOnly (worker transcribes and marks READY,
 * skipping classic clip picking). Do not set autoAgentClipMode, do not call
 * maybeAutoStartUploadAgentBatch, do not use createClipProject (that path starts the clipper).
 * No credit reservation or capture.
 */
export async function createCaptionsOnlyProject(
  workspaceId: string,
  uploadId: string,
  createdById: string | null,
): Promise<{ projectId: string }> {
  const prisma = getPrisma()
  const upload = await prisma.clipUpload.findFirst({
    where: { id: uploadId, workspaceId },
  })
  if (!upload) {
    throw new AiCaptionsError('source_not_found', 'That upload was not found in this workspace.', 404)
  }
  if (upload.status !== 'COMPLETE') {
    throw new AiCaptionsError('source_not_ready', 'The upload is not complete yet.', 400)
  }

  const projectId = createId('proj')
  const durationMs = upload.durationMs ?? 0
  const title = upload.filename.replace(/\.[^.]+$/, '') || 'Captions'
  const settings = captionsOnlyProjectSettings(durationMs)

  await prisma.clipProject.create({
    data: {
      id: projectId,
      workspaceId,
      createdById: createdById || undefined,
      title,
      uploadId: upload.id,
      settings,
      rangeStartMs: 0,
      rangeEndMs: durationMs,
      status: 'QUEUED',
      stage: 'queued',
      progress: 0,
      transcriptKey: projectWordsKey(workspaceId, projectId),
      sourceKind: 'upload',
    },
  })
  await prisma.clipJob.create({
    data: {
      id: createId('job'),
      projectId,
      type: 'PROCESS_PROJECT',
      status: 'QUEUED',
      payload: { agentOnly: true },
    },
  })
  return { projectId }
}

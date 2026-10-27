import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'
import { getOrCreateT2vWorkspaceJobProject } from '@/lib/server/t2v/workspace-job-project'
import type { T2vVoiceCloneJobPayload } from '@/lib/t2v/m9-contracts'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'
import { getAuthenticatedUserId } from '@/lib/server/auth/session'

const bodySchema = z.object({
  name: z.string().min(2).max(80),
  sampleUploadId: z.string().min(1),
  consent: z.literal(true),
})

/** Enqueues T2V_VOICE_CLONE — ElevenLabs + consent storage implemented by Agent B. */
export async function POST(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await getAuthenticatedUserId(request)
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const upload = await prisma.clipUpload.findFirst({
      where: { id: body.sampleUploadId, workspaceId, status: 'COMPLETE' },
    })
    if (!upload) return NextResponse.json({ error: 'sample_not_ready' }, { status: 400 })

    const payload: T2vVoiceCloneJobPayload = {
      workspaceId,
      name: body.name,
      sampleUploadId: body.sampleUploadId,
      consentAt: new Date().toISOString(),
      consentById: userId,
    }
    const project = await getOrCreateT2vWorkspaceJobProject(workspaceId)
    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: project.id,
        type: 'T2V_VOICE_CLONE',
        status: 'QUEUED',
        payload,
      },
    })
    return NextResponse.json({ data: { jobId, status: 'queued' } }, { status: 202 })
  } catch (err) {
    return jsonError(err, 400)
  }
}

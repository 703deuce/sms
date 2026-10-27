import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { applyWorkerJobProgress } from '@/lib/server/clips/job-progress'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { getPrisma } from '@/lib/server/db'
import { getClipStorageForObjectKey } from '@/lib/storage'

export const runtime = 'nodejs'
export const maxDuration = 30

const schema = z.object({
  projectStatus: z.string().optional(),
  stage: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  error: z.string().nullable().optional(),
  transcriptWords: z.array(z.unknown()).optional(),
  jobStatus: z.enum(['RUNNING', 'DONE', 'FAILED']).optional(),
  etaSeconds: z.number().int().min(0).optional(),
  chunkDone: z.number().int().min(0).optional(),
  chunkTotal: z.number().int().min(0).optional(),
  clipsReady: z.number().int().min(0).optional(),
  clipsTotal: z.number().int().min(0).optional(),
  transcriptionEngine: z.enum(['deepgram', 'local_whisper']).optional(),
  transcriptionFallbackReason: z.string().max(500).optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id: jobId } = await ctx.params
    const body = schema.parse(JSON.parse(raw))
    const prisma = getPrisma()
    const job = await prisma.clipJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        projectId: true,
        status: true,
        type: true,
        payload: true,
        error: true,
        project: { select: { transcriptKey: true, sourceKind: true } },
      },
    })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const payload = (job.payload ?? {}) as { draftId?: string }
    const isT2vAssemble = job.type === 'T2V_ASSEMBLE'
    let transcriptWordsForDb = body.transcriptWords
    if (
      body.transcriptWords?.length &&
      job.project.transcriptKey &&
      !isT2vAssemble
    ) {
      const storage = await getClipStorageForObjectKey(job.project.transcriptKey)
      await storage.putJson(job.project.transcriptKey, body.transcriptWords)
      transcriptWordsForDb = undefined
    }

    if (body.error?.trim()) {
      console.error('[clipper:job] worker_reported_error', {
        jobId,
        projectId: job.projectId,
        error: body.error.slice(0, 2000),
      })
    }

    await applyWorkerJobProgress({
      jobId,
      jobType: job.type,
      draftId: payload.draftId ?? null,
      projectId: job.projectId,
      storedJobStatus: job.status,
      storedJobError: job.error,
      projectSourceKind: job.project.sourceKind,
      projectStatus: body.projectStatus as import('@prisma/client').ClipProjectStatus | undefined,
      stage: body.stage,
      progress: body.progress,
      error: body.error,
      jobStatus: body.jobStatus,
      transcriptWords: transcriptWordsForDb,
      etaSeconds: body.etaSeconds,
      chunkDone: body.chunkDone,
      chunkTotal: body.chunkTotal,
      clipsReady: body.clipsReady,
      clipsTotal: body.clipsTotal,
      transcriptionEngine: body.transcriptionEngine,
      transcriptionFallbackReason: body.transcriptionFallbackReason,
    })

    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { applyJobProgress } from '@/lib/server/clips/jobs'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { getPrisma } from '@/lib/server/db'
import { putObjectJson, getS3Client, getS3Config, projectWordsKey } from '@/lib/storage/s3'

const schema = z.object({
  projectStatus: z.string().optional(),
  stage: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  error: z.string().nullable().optional(),
  transcriptWords: z.array(z.unknown()).optional(),
  jobStatus: z.enum(['RUNNING', 'DONE', 'FAILED']).optional(),
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
    const job = await prisma.clipJob.findUnique({ where: { id: jobId }, include: { project: true } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.transcriptWords) {
      const cfg = getS3Config()
      if (cfg && job.project.transcriptKey) {
        await putObjectJson(getS3Client(cfg), cfg.bucket, job.project.transcriptKey, body.transcriptWords)
      }
    }

    await applyJobProgress({
      jobId,
      projectStatus: body.projectStatus as import('@prisma/client').ClipProjectStatus | undefined,
      stage: body.stage,
      progress: body.progress,
      error: body.error,
      transcriptWords: body.transcriptWords,
    })

    if (body.jobStatus) {
      await prisma.clipJob.update({
        where: { id: jobId },
        data: {
          status: body.jobStatus,
          finishedAt: body.jobStatus === 'DONE' || body.jobStatus === 'FAILED' ? new Date() : undefined,
          lockedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { enqueueT2vExtractDeck } from '@/lib/server/t2v/enqueue-deck-extract'
import type { T2vExtractDeckResult } from '@/lib/t2v/m9-contracts'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

const postSchema = z.object({
  uploadId: z.string().min(1),
  draftId: z.string().optional(),
  projectId: z.string().optional(),
})

export async function POST(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = postSchema.parse(await request.json())
    const data = await enqueueT2vExtractDeck(workspaceId, body)
    return NextResponse.json({ data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'upload_not_ready') return NextResponse.json({ error: msg }, { status: 400 })
    return jsonError(err, 400)
  }
}

export async function GET(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const jobId = new URL(request.url).searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'jobId_required' }, { status: 400 })
    const prisma = getPrisma()
    const job = await prisma.clipJob.findFirst({
      where: { id: jobId, type: 'T2V_EXTRACT_DECK' },
      include: { project: { select: { workspaceId: true } } },
    })
    if (!job || job.project.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const payload = job.payload as { result?: T2vExtractDeckResult }
    return NextResponse.json({
      data: {
        jobId: job.id,
        status: job.status.toLowerCase(),
        error: job.error,
        result: payload.result,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

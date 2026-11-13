import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { advanceT2vPipeline } from '@/lib/server/t2v/pipeline/t2v-orchestrator'

const schema = z.object({ draftId: z.string(), workspaceId: z.string(), jobId: z.string() })

/** Worker → web: T2V_VERIFY_STOCK finished (results are on the job row). Tick the pipeline. */
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = schema.safeParse(JSON.parse(raw))
  if (!body.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  void advanceT2vPipeline(body.data.draftId)
  return NextResponse.json({ ok: true })
}

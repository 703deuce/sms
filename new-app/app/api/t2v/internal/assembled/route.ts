import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { applyT2vAssembled } from '@/lib/server/t2v/apply-assembled'

const schema = z.object({
  draftId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  revision: z.number().int(),
  jobId: z.string().optional(),
  sourceKey: z.string(),
  durationMs: z.number().int().positive(),
  sceneStartsMs: z.record(z.string(), z.number()),
  words: z.array(
    z.object({
      w: z.string(),
      s: z.number(),
      e: z.number(),
      i: z.number(),
      spk: z.number().optional(),
    }),
  ),
})

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = schema.parse(JSON.parse(raw))
    const data = await applyT2vAssembled(body)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}

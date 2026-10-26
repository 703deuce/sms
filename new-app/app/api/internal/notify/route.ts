import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { handleStreamerNotify } from '@/lib/server/streamer/notify'

const schema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(['stream_ready', 'stream_failed', 'stream_cap', 'autopull_failed', 'modal_budget']),
  vodId: z.string().optional(),
  montageId: z.string().optional(),
  data: z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = schema.parse(JSON.parse(raw))
    const result = await handleStreamerNotify(body)
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 500)
  }
}

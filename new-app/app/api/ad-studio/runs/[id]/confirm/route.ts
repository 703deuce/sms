import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { confirmAdRun } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'
import { adInvalid } from '@/lib/ad-studio/errors'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  console.info('[ad-studio:api:confirm] begin')
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json() as { idempotencyKey?: unknown }
    const headerKey = request.headers.get('Idempotency-Key')
    if (headerKey && body.idempotencyKey && headerKey !== body.idempotencyKey) throw adInvalid('Confirmation idempotency keys must match.')
    const run = await confirmAdRun(workspaceId, id, headerKey || body.idempotencyKey)
    console.info('[ad-studio:api:confirm] complete', { runId: id, status: run.status })
    return NextResponse.json({ run })
  } catch (err) { return adStudioJsonError(err) }
}

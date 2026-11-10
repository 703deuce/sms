import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { retryAdRender } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  console.info('[ad-studio:b3] retry_render_request_begin')
  try {
    const { id } = await context.params
    const workspaceId = await resolveWorkspaceId()
    const idempotencyKey = request.headers.get('Idempotency-Key')
    const run = await retryAdRender(workspaceId, id, idempotencyKey)
    console.info('[ad-studio:b3] retry_render_request_complete', { runId: id, status: run.status })
    return NextResponse.json({ run })
  } catch (err) {
    return adStudioJsonError(err)
  }
}

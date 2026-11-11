import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { regenerateAdImageVariant } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function POST(request: Request, context: { params: Promise<{ id: string; variantId: string }> }) {
  console.info('[ad-studio:r5] still_regenerate_request_begin')
  try {
    const { id, variantId } = await context.params
    const workspaceId = await resolveWorkspaceId()
    const idempotencyKey = request.headers.get('Idempotency-Key')
    const run = await regenerateAdImageVariant(workspaceId, id, variantId, idempotencyKey)
    console.info('[ad-studio:r5] still_regenerate_request_complete', { runId: id, variantId, status: run.status })
    return NextResponse.json({ run })
  } catch (err) {
    return adStudioJsonError(err)
  }
}

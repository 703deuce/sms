import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createCommercialFromImageAd } from '@/lib/server/ad-studio/commercial'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  console.info('[ad-studio:b3] commercial_route_begin')
  try {
    const { id } = await context.params
    const workspaceId = await resolveWorkspaceId()
    const result = await createCommercialFromImageAd(workspaceId, id, await request.json())
    console.info('[ad-studio:b3] commercial_route_complete', { sourceRunId: id, runId: result.run.id, status: result.run.status })
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (err) {
    return adStudioJsonError(err)
  }
}

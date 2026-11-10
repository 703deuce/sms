import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { continueAdRun } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  console.info('[ad-studio:b3] continue_request_begin')
  try {
    const { id } = await context.params
    const workspaceId = await resolveWorkspaceId()
    const run = await continueAdRun(workspaceId, id)
    console.info('[ad-studio:b3] continue_request_complete', { runId: id, status: run.status })
    return NextResponse.json({ run })
  } catch (err) {
    return adStudioJsonError(err)
  }
}

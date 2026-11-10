import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { replanAdRun } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  console.info('[ad-studio:api:replan] begin')
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const patch: unknown = await request.json()
    const run = await replanAdRun(workspaceId, id, patch)
    console.info('[ad-studio:api:replan] complete', { runId: id, status: run.status })
    return NextResponse.json({ run })
  } catch (err) { return adStudioJsonError(err) }
}

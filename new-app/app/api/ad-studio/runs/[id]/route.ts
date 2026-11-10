import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getAdRun } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  console.info('[ad-studio:api:run] get_begin')
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const run = await getAdRun(workspaceId, id)
    console.info('[ad-studio:api:run] get_success', { runId: id, status: run.status })
    return NextResponse.json({ run })
  } catch (err) { return adStudioJsonError(err) }
}

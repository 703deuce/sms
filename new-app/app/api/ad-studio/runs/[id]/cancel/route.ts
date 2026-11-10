import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { cancelAdRun } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  console.info('[ad-studio:api:cancel] begin')
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const run = await cancelAdRun(workspaceId, id)
    console.info('[ad-studio:api:cancel] complete', { runId: id, status: run.status })
    return NextResponse.json({ run })
  } catch (err) { return adStudioJsonError(err) }
}

import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '../../../../../lib/server/workspace'
import { studioJsonError } from '../../../../../lib/studio/http'
import { getStudioJob } from '../../../../../lib/studio/jobs'
import { createDefaultStudioService } from '../../../../../lib/studio/runtime'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const job = await getStudioJob(createDefaultStudioService(), workspaceId, id)
    return NextResponse.json({ job })
  } catch (err) {
    return studioJsonError(err)
  }
}

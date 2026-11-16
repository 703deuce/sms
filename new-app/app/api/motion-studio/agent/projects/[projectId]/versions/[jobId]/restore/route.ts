import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { restoreAgentVersion } from '@/lib/server/motion-studio/agent-bridge'
export async function POST(request: Request, ctx: { params: Promise<{ projectId:string; jobId:string }> }) {
  try {
    const { projectId, jobId } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    return NextResponse.json(await restoreAgentVersion(workspaceId,projectId,jobId))
  } catch (err) { return motionStudioJsonError(err) }
}

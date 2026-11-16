import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { agentThread, submitAgentRevision } from '@/lib/server/motion-studio/agent-bridge'

type Ctx = { params: Promise<{ projectId: string }> }
export async function GET(request: Request, ctx: Ctx) {
  try {
    const { projectId } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    return NextResponse.json(await agentThread(workspaceId, projectId))
  } catch (err) { return motionStudioJsonError(err) }
}
export async function POST(request: Request, ctx: Ctx) {
  try {
    const { projectId } = await ctx.params
    const { workspaceId, userId } = await requireMotionStudioCaller(request)
    return NextResponse.json({ job: await submitAgentRevision(workspaceId, userId, projectId, request, await request.json()) }, { status: 202 })
  } catch (err) { return motionStudioJsonError(err) }
}

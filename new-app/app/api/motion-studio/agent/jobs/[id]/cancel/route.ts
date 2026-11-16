import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { cancelAgentJob } from '@/lib/server/motion-studio/agent-bridge'
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const input = await request.json().catch(()=>({})) as { projectId?: unknown }
    if (typeof input.projectId !== 'string') return NextResponse.json({ error: 'Project required' }, { status:400 })
    return NextResponse.json({ job: await cancelAgentJob(workspaceId,input.projectId,id) })
  } catch (err) { return motionStudioJsonError(err) }
}

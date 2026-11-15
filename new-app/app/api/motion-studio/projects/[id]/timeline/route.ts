import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getTimeline } from '@/lib/server/motion-studio/service'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const result = await getTimeline(workspaceId, id)
    return NextResponse.json(result)
  } catch (err) { return motionStudioJsonError(err) }
}

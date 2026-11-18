import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getTimeline, getTimelineSnapshot } from '@/lib/server/motion-studio/service'
import { pollingRoute } from '@/lib/server/db-read-gate'

export const GET = pollingRoute(async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const passive = new URL(request.url).searchParams.get('passive') === '1'
    const result = passive ? await getTimelineSnapshot(workspaceId, id) : await getTimeline(workspaceId, id)
    return NextResponse.json(result)
  } catch (err) { return motionStudioJsonError(err) }
})

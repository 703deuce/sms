import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { listActivity } from '@/lib/server/motion-studio/service'
import { pollingRoute } from '@/lib/server/db-read-gate'

export const GET = pollingRoute(async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const url = new URL(request.url)
    return NextResponse.json(await listActivity(workspaceId, id, { after: url.searchParams.get('after'), limit: url.searchParams.get('limit') }))
  } catch (err) { return motionStudioJsonError(err) }
})

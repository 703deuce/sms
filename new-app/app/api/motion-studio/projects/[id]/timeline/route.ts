import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getTimeline } from '@/lib/server/motion-studio/service'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    return NextResponse.json(await getTimeline(await resolveWorkspaceId(), id))
  } catch (err) { return motionStudioJsonError(err) }
}

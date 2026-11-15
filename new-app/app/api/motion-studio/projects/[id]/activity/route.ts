import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { listActivity } from '@/lib/server/motion-studio/service'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const url = new URL(request.url)
    return NextResponse.json(await listActivity(await resolveWorkspaceId(), id, { after: url.searchParams.get('after'), limit: url.searchParams.get('limit') }))
  } catch (err) { return motionStudioJsonError(err) }
}

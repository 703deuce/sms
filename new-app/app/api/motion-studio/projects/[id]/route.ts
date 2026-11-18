import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getProject, patchProject } from '@/lib/server/motion-studio/service'
import { pollingRoute } from '@/lib/server/db-read-gate'

export const GET = pollingRoute(async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const result = await getProject(workspaceId, id)
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
})

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const body: unknown = await request.json().catch(() => ({}))
    const result = await patchProject(workspaceId, id, body)
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

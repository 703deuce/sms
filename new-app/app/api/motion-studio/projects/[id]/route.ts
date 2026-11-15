import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getProject, patchProject } from '@/lib/server/motion-studio/service'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const result = await getProject(workspaceId, id)
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body: unknown = await request.json().catch(() => ({}))
    const result = await patchProject(workspaceId, id, body)
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

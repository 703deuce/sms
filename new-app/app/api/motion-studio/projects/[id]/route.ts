import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getProject, patchProject } from '@/lib/server/motion-studio/service'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    return NextResponse.json({ project: await getProject(await resolveWorkspaceId(), id) })
  } catch (err) { return motionStudioJsonError(err) }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body: unknown = await request.json().catch(() => ({}))
    return NextResponse.json({ project: await patchProject(await resolveWorkspaceId(), id, body) })
  } catch (err) { return motionStudioJsonError(err) }
}

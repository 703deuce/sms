import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { updateScene } from '@/lib/server/motion-studio/service'

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string; sceneId: string }> }) {
  try {
    const { id, sceneId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body: unknown = await request.json().catch(() => ({}))
    const result = await updateScene(workspaceId, id, sceneId, body)
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

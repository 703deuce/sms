import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { regenerateScene } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string; sceneId: string }> }) {
  try {
    const { id, sceneId } = await ctx.params
    const body: unknown = await request.json().catch(() => ({}))
    return NextResponse.json({ project: await regenerateScene(await resolveWorkspaceId(), id, sceneId, body) })
  } catch (err) { return motionStudioJsonError(err) }
}

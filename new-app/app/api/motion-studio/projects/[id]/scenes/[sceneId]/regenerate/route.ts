import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { regenerateScene } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string; sceneId: string }> }) {
  try {
    const { id, sceneId } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const body: unknown = await request.json().catch(() => ({}))
    const key = request.headers.get('Idempotency-Key')
    const result = await regenerateScene(workspaceId, id, sceneId, body, key)
    console.info('[motion-studio:api:regenerate] ok', { projectId: id })
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

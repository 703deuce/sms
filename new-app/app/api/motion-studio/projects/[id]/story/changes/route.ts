import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { requestStoryChanges } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const body: unknown = await request.json().catch(() => ({}))
    const result = await requestStoryChanges(workspaceId, id, body)
    console.info('[motion-studio:api:changes] ok', { projectId: id })
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { sendDirectorMessage } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const body: unknown = await request.json().catch(() => ({}))
    const result = await sendDirectorMessage(workspaceId, id, body)
    console.info('[motion-studio:api:director] ok', { projectId: id })
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { openInEditor } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const result = await openInEditor(workspaceId, id)
    console.info('[motion-studio:api:open-in-editor] ok', { projectId: id })
    return NextResponse.json(result)
  } catch (err) { return motionStudioJsonError(err) }
}

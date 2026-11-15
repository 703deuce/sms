import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { startExport } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const key = request.headers.get('Idempotency-Key')
    const result = await startExport(workspaceId, id, key)
    console.info('[motion-studio:api:export] ok', { projectId: id })
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

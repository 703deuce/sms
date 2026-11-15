import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getAllowance } from '@/lib/server/motion-studio/service'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const result = await getAllowance(workspaceId, id)
    return NextResponse.json({ allowance: result })
  } catch (err) { return motionStudioJsonError(err) }
}

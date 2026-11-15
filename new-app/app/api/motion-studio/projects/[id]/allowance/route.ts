import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getAllowance } from '@/lib/server/motion-studio/service'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const result = await getAllowance(workspaceId, id)
    return NextResponse.json({ allowance: result })
  } catch (err) { return motionStudioJsonError(err) }
}

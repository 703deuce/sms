import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { decideProposal } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const { id, proposalId } = await ctx.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const body: unknown = await request.json().catch(() => ({}))
    const result = await decideProposal(workspaceId, id, proposalId, 'reject', body)
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

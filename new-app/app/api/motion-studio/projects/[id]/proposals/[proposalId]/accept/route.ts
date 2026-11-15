import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { decideProposal } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const { id, proposalId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body: unknown = await request.json().catch(() => ({}))
    const result = await decideProposal(workspaceId, id, proposalId, 'accept', body)
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { retryStep } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string; stage: string }> }) {
  try {
    const { id, stage } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const key = request.headers.get('Idempotency-Key')
    const result = await retryStep(workspaceId, id, stage, key)
    console.info('[motion-studio:api:retry] ok', { projectId: id })
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}

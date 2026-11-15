import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { requestChanges } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body: unknown = await request.json().catch(() => ({}))
    const project = await requestChanges(await resolveWorkspaceId(), id, body)
    console.info('[motion-studio:api:request-changes] ok', { projectId: id, status: project.status })
    return NextResponse.json({ project })
  } catch (err) { return motionStudioJsonError(err) }
}

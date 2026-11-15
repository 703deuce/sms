import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { retryProject } from '@/lib/server/motion-studio/service'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const project = await retryProject(await resolveWorkspaceId(), id)
    console.info('[motion-studio:api:retry] ok', { projectId: id, status: project.status })
    return NextResponse.json({ project })
  } catch (err) { return motionStudioJsonError(err) }
}

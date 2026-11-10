import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { studioJsonError } from '@/lib/studio/http'
import { registerStudioOutputForClip } from '@/lib/studio/register-output-media'
import { createDefaultStudioService } from '@/lib/studio/runtime'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = (await request.json().catch(() => ({}))) as { projectId?: string; clipId?: string }
    const result = await registerStudioOutputForClip(createDefaultStudioService(), {
      workspaceId,
      jobId: id,
      projectId: body.projectId || '',
      clipId: body.clipId || '',
    })
    return NextResponse.json(result)
  } catch (err) {
    return studioJsonError(err)
  }
}

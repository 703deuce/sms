import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '../../../../../../lib/server/workspace'
import { studioJsonError } from '../../../../../../lib/studio/http'
import { createDefaultStudioService } from '../../../../../../lib/studio/runtime'
import { sendStudioJobToTimeline } from '../../../../../../lib/studio/send-to-timeline'
import { defaultTimelineWriter } from '../../../../../../lib/studio/send-to-timeline-prisma'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = (await request.json().catch(() => ({}))) as { projectId?: string; clipId?: string }
    const result = await sendStudioJobToTimeline(createDefaultStudioService(), {
      workspaceId,
      jobId: id,
      projectId: body.projectId || '',
      clipId: body.clipId,
      write: defaultTimelineWriter,
    })
    return NextResponse.json(result)
  } catch (err) {
    return studioJsonError(err)
  }
}

import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { createFindClipsProjectFromFullVideo } from '@/lib/server/clips/full-video-projects'
import { queueFindClipsJob } from '@/lib/server/clips/find-clips-job'
import { serializeProject } from '@/lib/server/clips/serialize'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** FV1: "Find clips in this video" from a full-video project (transcript reused, no new ASR). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    let body: { mode?: 'highlights' | 'project' } = {}
    try {
      body = (await request.json()) as typeof body
    } catch {
      body = {}
    }
    const mode = body.mode === 'highlights' ? 'highlights' : 'project'
    if (mode === 'highlights') {
      const queued = await queueFindClipsJob(workspaceId, projectId)
      if (!queued) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data: { jobId: queued.jobId, mode: 'highlights' as const } })
    }
    const project = await createFindClipsProjectFromFullVideo(workspaceId, projectId)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: serializeProject(project) })
  } catch (err) {
    return jsonError(err, 400)
  }
}

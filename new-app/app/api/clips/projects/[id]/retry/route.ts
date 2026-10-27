import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { retryClipProject } from '@/lib/server/clips/retry-clip-project'
import { retryStreamerProject } from '@/lib/server/streamer/retry-project'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.status !== 'FAILED' && project.status !== 'CANCELED') {
      return NextResponse.json({ error: 'Project is not in a failed state' }, { status: 409 })
    }

    const streamVod = await prisma.streamVod.findUnique({ where: { projectId } })
    if (streamVod) {
      const { jobId, jobType } = await retryStreamerProject(workspaceId, projectId)
      return NextResponse.json({ data: { ok: true, jobId, jobType } })
    }

    const retried = await retryClipProject(workspaceId, projectId)
    if (!retried) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      data: { ok: true, jobId: retried.jobId, status: retried.status, resume: retried.resume },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

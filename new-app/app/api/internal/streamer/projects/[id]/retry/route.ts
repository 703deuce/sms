import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { getPrisma } from '@/lib/server/db'
import { retryStreamerProject } from '@/lib/server/streamer/retry-project'

export const runtime = 'nodejs'

/** Ops/worker: same logic as POST /api/clips/projects/[id]/retry (HMAC). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id: projectId } = await ctx.params
    const prisma = getPrisma()
    const project = await prisma.clipProject.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, status: true },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.status !== 'FAILED' && project.status !== 'CANCELED') {
      return NextResponse.json({ error: 'Project is not in a failed state' }, { status: 409 })
    }
    const vod = await prisma.streamVod.findUnique({ where: { projectId } })
    if (!vod) return NextResponse.json({ error: 'Not a streamer project' }, { status: 400 })
    const { jobId, jobType } = await retryStreamerProject(project.workspaceId, projectId)
    return NextResponse.json({ data: { ok: true, jobId, jobType } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

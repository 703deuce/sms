import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string; jobId: string }> }) {
  try {
    const { id: clipId, jobId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const prisma = getPrisma()
    const job = await prisma.clipJob.findFirst({
      where: { id: jobId, clipId, projectId: clip.projectId },
      select: { status: true, error: true, progress: true },
    })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      data: {
        status: job.status,
        error: job.error,
        progress: job.progress,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { stopProjectRollingAutopull } from '@/lib/server/streamer/rolling-autopull'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { projectId } = await ctx.params
    const prisma = getPrisma()
    const project = await prisma.clipProject.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    const result = await stopProjectRollingAutopull(projectId, 'operator_stop')
    console.info(
      `[editor:decision] ${JSON.stringify({
        ts: Date.now() / 1000,
        stage: 'editor',
        event: 'stop_auto_pull',
        projectId,
        stopped: result.stopped,
        cancelledJobIds: result.cancelledJobIds,
      })}`,
    )
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 400)
  }
}

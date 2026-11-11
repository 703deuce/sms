import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** Cancel ONLY a queued, workspace-owned template render before any worker has claimed its job. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = (await ctx.params).id
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const canceled = await prisma.$transaction(async tx => {
      const render = await tx.clipRender.findFirst({
        where: { id, workspaceId, status: 'QUEUED' },
        select: { id: true, clipId: true, clip: { select: { aiMeta: true } } },
      })
      if (!render) return false
      const meta = render.clip.aiMeta
      if (!meta || typeof meta !== 'object' || Array.isArray(meta) ||
          !('videoTemplate' in meta)) return false
      const queued = await tx.clipJob.updateMany({
        where: { clipId: render.clipId, type: 'RENDER_CLIP', status: 'QUEUED',
          payload: { path: ['renderId'], equals: id } },
        data: { status: 'FAILED', error: 'Canceled before render started', finishedAt: new Date() },
      })
      if (queued.count !== 1) return false
      const changed = await tx.clipRender.updateMany({
        where: { id, workspaceId, status: 'QUEUED' },
        data: { status: 'FAILED', error: 'Canceled before render started' },
      })
      if (changed.count !== 1) throw new Error('Cancel raced with a worker')
      return true
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (!canceled) return NextResponse.json({ error: 'Only an unclaimed template render can be canceled' }, { status: 409 })
    return NextResponse.json({ data: { canceled: true } })
  } catch (error) { return jsonError(error, 409) }
}

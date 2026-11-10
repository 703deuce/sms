import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { enqueueClipCardThumbnail } from '@/lib/server/clips/card-thumbnails'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const started = Date.now()
  try {
    const { id: projectId } = await params
    const workspaceId = await resolveWorkspaceId()
    console.info('[clips:cards] thumbnail backfill route_begin', { projectId })
    const prisma = getPrisma()
    const project = await prisma.clipProject.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { id: true },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const clips = await prisma.clip.findMany({
      where: { projectId, workspaceId, deletedAt: null, posterKey: null },
      select: { id: true },
      take: 100,
    })
    let queued = 0
    for (const clip of clips) {
      console.info('[clips:cards] thumbnail backfill clip_begin', { projectId, clipId: clip.id })
      if (await enqueueClipCardThumbnail(workspaceId, clip.id, 'page_load_backfill')) queued += 1
      console.info('[clips:cards] thumbnail backfill clip_end', {
        projectId, clipId: clip.id, elapsedMs: Date.now() - started,
      })
    }
    console.info('[clips:cards] thumbnail backfill route_end', {
      projectId, checked: clips.length, queued, elapsedMs: Date.now() - started,
    })
    return NextResponse.json({ data: { checked: clips.length, queued } })
  } catch (error) {
    console.error('[clips:cards] thumbnail backfill route_failed', {
      elapsedMs: Date.now() - started, error: String(error),
    })
    return jsonError(error, 400)
  }
}

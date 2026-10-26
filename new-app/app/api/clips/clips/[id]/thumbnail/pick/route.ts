import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeEdits } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({ thumbnailId: z.string().min(1) })

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { thumbnailId } = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const thumb = await prisma.clipThumbnail.findFirst({ where: { id: thumbnailId, clipId, workspaceId } })
    if (!thumb) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.clipThumbnail.updateMany({ where: { clipId, workspaceId }, data: { picked: false } })
    await prisma.clipThumbnail.update({ where: { id: thumbnailId }, data: { picked: true } })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    await prisma.clip.update({
      where: { id: clipId },
      data: { edits: { ...edits, thumbnailId } as object },
    })

    return NextResponse.json({ data: { ok: true, thumbnailId } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

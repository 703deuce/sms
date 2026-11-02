import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'
import { normalizeEdits } from '@/lib/clips/edits'
import { getClipStorage } from '@/lib/storage'

const bodySchema = z.object({
  aspect: z.enum(['9:16', '16:9']).default('9:16'),
  frameMs: z.number().int().min(0),
  overlayPreset: z.enum(['none', 'bold_title', 'lower_third', 'minimal']).default('none'),
  titleText: z.string().max(80).optional(),
  imageBase64: z.string().min(32),
})

/** Q5: pick a real source frame + optional text overlay — no credits, no AI job. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const raw = body.imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buf = Buffer.from(raw, 'base64')
    if (buf.length < 100 || buf.length > 4_000_000) {
      return NextResponse.json({ error: 'Invalid image' }, { status: 400 })
    }

    const thumbId = createId('thumb')
    const generationId = `free_${thumbId}`
    const storage = getClipStorage(clip.storageDriver)
    const key = `clips/thumbnails/${clipId}/${thumbId}.jpg`
    await storage.putBytes(key, buf, 'image/jpeg')

    const prisma = getPrisma()
    await prisma.clipThumbnail.updateMany({ where: { clipId, workspaceId }, data: { picked: false } })
    await prisma.clipThumbnail.create({
      data: {
        id: thumbId,
        workspaceId,
        clipId,
        generationId,
        aspect: body.aspect,
        sourceFrameMs: body.frameMs,
        prompt: 'free_frame',
        titleText: body.titleText?.trim() || null,
        imageKey: key,
        picked: true,
      },
    })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    await prisma.clip.update({
      where: { id: clipId },
      data: { edits: { ...edits, thumbnailId: thumbId } as object },
    })

    const downloadUrl = await storage.createSignedDownloadUrl(key, 3600).catch(() => null)
    return NextResponse.json({
      data: { thumbnailId: thumbId, downloadUrl, credits: 0 },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getClipEditorPayload, mergeEditsPatch } from '@/lib/server/clips/clip-detail'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  favorite: z.boolean().optional(),
  edits: z.record(z.unknown()).optional(),
  hidden: z.boolean().optional(),
  disliked: z.boolean().optional(),
})

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const data = await getClipEditorPayload(workspaceId, id)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = patchSchema.parse(await request.json())
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title
    if (body.favorite !== undefined) data.favorite = body.favorite
    if (body.edits !== undefined) {
      const { normalizeEdits } = await import('@/lib/clips/edits')
      data.edits = mergeEditsPatch(normalizeEdits(clip.edits, bounds), body.edits, bounds)
    }
    if (body.hidden !== undefined || body.disliked !== undefined) {
      const prev = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as Record<string, unknown>
      const meta = { ...prev }
      if (body.hidden !== undefined) meta.userHidden = body.hidden
      if (body.disliked !== undefined) {
        meta.userFeedback = body.disliked ? 'dislike' : null
      }
      data.aiMeta = meta
    }
    const prisma = getPrisma()
    const updated = await prisma.clip.update({ where: { id }, data })
    return NextResponse.json({ data: { id: updated.id, title: updated.title, edits: updated.edits } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

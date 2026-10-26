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
    const durationMs = clip.endMs - clip.startMs
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title
    if (body.favorite !== undefined) data.favorite = body.favorite
    if (body.edits !== undefined) {
      const { normalizeEdits } = await import('@/lib/clips/edits')
      data.edits = mergeEditsPatch(normalizeEdits(clip.edits, durationMs), body.edits, durationMs)
    }
    const prisma = getPrisma()
    const updated = await prisma.clip.update({ where: { id }, data })
    return NextResponse.json({ data: { id: updated.id, title: updated.title, edits: updated.edits } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

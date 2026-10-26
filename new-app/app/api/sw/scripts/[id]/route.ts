import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner, saveScriptEditorMeta, saveScriptPmJson } from '@/lib/screenwriting/server/scripts'

const putSchema = z.object({
  pmJson: z.unknown().optional(),
  editorMeta: z.record(z.unknown()).optional(),
  title: z.string().min(1).max(200).optional(),
})

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const actor = getActor()
    const script = await getScriptForOwner(id, actor.id)
    if (!script) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: script })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const actor = getActor()
    const body = putSchema.parse(await request.json())
    if (body.pmJson !== undefined) {
      await saveScriptPmJson(id, actor.id, body.pmJson as object)
    }
    if (body.editorMeta !== undefined) {
      await saveScriptEditorMeta(id, actor.id, body.editorMeta as import('@prisma/client').Prisma.InputJsonValue)
    }
    const script = await getScriptForOwner(id, actor.id)
    if (!script) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { ok: true, updatedAt: script.updatedAt } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

import { NextResponse } from 'next/server'
import type { JSONContent } from '@tiptap/core'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner, saveScriptPmJson } from '@/lib/screenwriting/server/scripts'

const putSchema = z.object({
  pmJson: z.record(z.unknown()),
})

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const row = await getScriptForOwner(id, actor.id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      data: {
        pmJson: row.pmJson,
        pageCount: row.pageCount,
        wordCount: row.wordCount,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const body = putSchema.parse(await request.json())
    await saveScriptPmJson(id, actor.id, body.pmJson as JSONContent)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

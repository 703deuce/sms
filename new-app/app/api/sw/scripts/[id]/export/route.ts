import { NextResponse } from 'next/server'
import type { JSONContent } from '@tiptap/core'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { pmJsonToFountain, pmJsonToPlainTxt } from '@/lib/screenwriting/fountain/convert'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const format = new URL(request.url).searchParams.get('format') || 'fountain'
    const row = await getScriptForOwner(id, actor.id)
    if (!row?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const doc = row.pmJson as JSONContent
    if (format === 'txt') {
      const text = pmJsonToPlainTxt(doc)
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${row.title || 'script'}.txt"`,
        },
      })
    }
    const fountain = pmJsonToFountain(doc)
    return new NextResponse(fountain, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${row.title || 'script'}.fountain"`,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

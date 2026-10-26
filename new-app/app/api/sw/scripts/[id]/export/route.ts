import { NextResponse } from 'next/server'
import type { JSONContent } from '@tiptap/core'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { pmJsonToFountain, pmJsonToPlainTxt } from '@/lib/screenwriting/fountain/convert'
import { pmJsonToFdx } from '@/lib/screenwriting/fdx/serialize'
import { renderScriptPdf } from '@/lib/screenwriting/pdf/render'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const format = new URL(request.url).searchParams.get('format') || 'fountain'
    const row = await getScriptForOwner(id, actor.id)
    if (!row?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const doc = row.pmJson as JSONContent
    if (format === 'fdx') {
      const xml = pmJsonToFdx(doc)
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${row.title || 'script'}.fdx"`,
        },
      })
    }
    if (format === 'pdf') {
      const pdf = await renderScriptPdf(doc, { title: row.title || 'Script' })
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${row.title || 'script'}.pdf"`,
        },
      })
    }
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

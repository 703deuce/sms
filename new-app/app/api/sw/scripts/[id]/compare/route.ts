import { NextResponse } from 'next/server'
import type { JSONContent } from '@tiptap/core'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'
import { alignElements, wordDiffHtml } from '@/lib/screenwriting/versions/compare'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const url = new URL(request.url)
    const aId = url.searchParams.get('a')
    const bId = url.searchParams.get('b')
    if (!aId || !bId) return NextResponse.json({ error: 'a and b required' }, { status: 400 })
    await getScriptForOwner(id, actor.id)
    const prisma = getPrisma()
    const va = await prisma.swVersion.findFirst({ where: { id: aId, scriptId: id } })
    if (!va?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    let vbPm: JSONContent
    if (bId === 'current') {
      const script = await getScriptForOwner(id, actor.id)
      vbPm = (script?.pmJson ?? { type: 'doc', content: [] }) as JSONContent
    } else {
      const vb = await prisma.swVersion.findFirst({ where: { id: bId, scriptId: id } })
      if (!vb?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      vbPm = vb.pmJson as JSONContent
    }
    const aligned = alignElements(va.pmJson as JSONContent, vbPm)
    const html = aligned.map((row) => ({
      id: row.id,
      type: row.type,
      diff: wordDiffHtml(row.textA, row.textB),
    }))
    return NextResponse.json({ data: { aligned, html } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

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
    const [va, vb] = await Promise.all([
      prisma.swVersion.findFirst({ where: { id: aId, scriptId: id } }),
      prisma.swVersion.findFirst({ where: { id: bId, scriptId: id } }),
    ])
    if (!va?.pmJson || !vb?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const aligned = alignElements(va.pmJson as JSONContent, vb.pmJson as JSONContent)
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

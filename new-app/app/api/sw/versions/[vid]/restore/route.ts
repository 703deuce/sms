import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getPrisma } from '@/lib/server/db'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'

export async function POST(_request: Request, ctx: { params: Promise<{ vid: string }> }) {
  try {
    const actor = await requireSwActor()
    const { vid } = await ctx.params
    const prisma = getPrisma()
    const version = await prisma.swVersion.findUnique({ where: { id: vid } })
    if (!version?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await getScriptForOwner(version.scriptId, actor.id)

    await prisma.swVersion.create({
      data: {
        scriptId: version.scriptId,
        kind: 'PRE_RESTORE',
        label: 'Before restore',
        pmJson: version.pmJson,
        yState: version.yState,
        pageCount: version.pageCount,
        createdById: actor.id,
      },
    })

    await prisma.swScript.update({
      where: { id: version.scriptId },
      data: {
        pmJson: version.pmJson,
        pageCount: version.pageCount,
      },
    })

    return NextResponse.json({ data: { ok: true, scriptId: version.scriptId } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

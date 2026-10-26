import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const row = await getScriptForOwner(id, actor.id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const prisma = getPrisma()
    const versions = await prisma.swVersion.findMany({
      where: { scriptId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ data: versions })
  } catch (err) {
    return jsonError(err, 400)
  }
}

const postSchema = z.object({
  label: z.string().optional(),
  kind: z.enum(['AUTO', 'MANUAL', 'IMPORT', 'PRODUCTION_DRAFT', 'PRE_RESTORE', 'LOCK']).default('MANUAL'),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const body = postSchema.parse(await request.json())
    const row = await getScriptForOwner(id, actor.id)
    if (!row?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const prisma = getPrisma()
    const version = await prisma.swVersion.create({
      data: {
        scriptId: id,
        kind: body.kind,
        label: body.label,
        pmJson: row.pmJson,
        yState: row.yState ?? Buffer.alloc(0),
        pageCount: row.pageCount,
        createdById: actor.id,
      },
    })
    return NextResponse.json({ data: version })
  } catch (err) {
    return jsonError(err, 400)
  }
}

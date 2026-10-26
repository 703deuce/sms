import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getPrisma } from '@/lib/server/db'

const patchSchema = z.object({
  label: z.string().min(1).max(200),
})

export async function PATCH(request: Request, ctx: { params: Promise<{ vid: string }> }) {
  try {
    const actor = await requireSwActor()
    const { vid } = await ctx.params
    const body = patchSchema.parse(await request.json())
    const prisma = getPrisma()
    const version = await prisma.swVersion.findUnique({ where: { id: vid } })
    if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const script = await prisma.swScript.findFirst({
      where: { id: version.scriptId, project: { ownerId: actor.id } },
    })
    if (!script) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated = await prisma.swVersion.update({
      where: { id: vid },
      data: { label: body.label },
    })
    return NextResponse.json({ data: updated })
  } catch (err) {
    return jsonError(err, 400)
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'

const postSchema = z.object({
  kind: z.enum(['character', 'location', 'note']),
  name: z.string().min(1),
  body: z.string(),
  linkedCharacter: z.string().optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    await getScriptForOwner(id, actor.id)
    const rows = await getPrisma().swStoryBibleEntry.findMany({ where: { scriptId: id }, orderBy: { name: 'asc' } })
    return NextResponse.json({ data: rows })
  } catch (e) {
    return jsonError(e, 400)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    await getScriptForOwner(id, actor.id)
    const body = postSchema.parse(await request.json())
    const row = await getPrisma().swStoryBibleEntry.create({
      data: { scriptId: id, ...body },
    })
    return NextResponse.json({ data: row })
  } catch (e) {
    return jsonError(e, 400)
  }
}

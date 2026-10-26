import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'

const postSchema = z.object({ body: z.string().min(1).max(4000) })

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    await getScriptForOwner(id, actor.id)
    const rows = await getPrisma().swChatMessage.findMany({
      where: { scriptId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
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
    const row = await getPrisma().swChatMessage.create({
      data: { scriptId: id, authorId: actor.id, authorName: actor.name, body: body.body },
    })
    return NextResponse.json({ data: row })
  } catch (e) {
    return jsonError(e, 400)
  }
}

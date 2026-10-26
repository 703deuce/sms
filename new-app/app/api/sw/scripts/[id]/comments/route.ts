import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'

const postSchema = z.object({
  elementId: z.string(),
  anchorFrom: z.string(),
  anchorTo: z.string(),
  body: z.string().min(1).max(10_000),
})

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    await getScriptForOwner(id, actor.id)
    const prisma = getPrisma()
    const threads = await prisma.swCommentThread.findMany({
      where: { scriptId: id },
      include: { comments: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: threads })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const body = postSchema.parse(await request.json())
    await getScriptForOwner(id, actor.id)
    const prisma = getPrisma()
    const thread = await prisma.swCommentThread.create({
      data: {
        scriptId: id,
        elementId: body.elementId,
        anchorFrom: body.anchorFrom,
        anchorTo: body.anchorTo,
        comments: {
          create: {
            authorId: actor.id,
            authorName: actor.name ?? 'Writer',
            body: body.body,
          },
        },
      },
      include: { comments: true },
    })
    return NextResponse.json({ data: thread })
  } catch (err) {
    return jsonError(err, 400)
  }
}

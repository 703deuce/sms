import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner, saveScriptPmJson } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'
import type { Prisma } from '@prisma/client'

const postSchema = z.object({
  sceneElementId: z.string(),
  label: z.string().optional(),
  pmJson: z.record(z.unknown()),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    await getScriptForOwner(id, actor.id)
    const rows = await getPrisma().swSceneVersion.findMany({
      where: { scriptId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ data: rows })
  } catch (e) {
    return jsonError(e, 400)
  }
}

const patchSchema = z.object({ versionId: z.string(), apply: z.literal(true) })

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    await getScriptForOwner(id, actor.id)
    const body = patchSchema.parse(await request.json())
    const ver = await getPrisma().swSceneVersion.findFirst({ where: { id: body.versionId, scriptId: id } })
    if (!ver) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await saveScriptPmJson(id, actor.id, ver.pmJson as object)
    return NextResponse.json({ data: { ok: true } })
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
    const row = await getPrisma().swSceneVersion.create({
      data: {
        scriptId: id,
        sceneElementId: body.sceneElementId,
        label: body.label,
        pmJson: body.pmJson as Prisma.InputJsonValue,
      },
    })
    return NextResponse.json({ data: row })
  } catch (e) {
    return jsonError(e, 400)
  }
}

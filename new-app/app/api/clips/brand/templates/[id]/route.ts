import { NextResponse } from 'next/server'
import { z } from 'zod'
import { brandTemplateSettingsSchema } from '@/lib/clips/brand'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  settings: brandTemplateSettingsSchema.partial().optional(),
  logoKey: z.string().nullable().optional(),
})

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = patchSchema.parse(await request.json())
    const prisma = getPrisma()
    const row = await prisma.clipBrandTemplate.findFirst({ where: { id, workspaceId } })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const nextSettings = body.settings
      ? brandTemplateSettingsSchema.parse({
          ...brandTemplateSettingsSchema.parse(row.settings),
          ...body.settings,
        })
      : brandTemplateSettingsSchema.parse(row.settings)
    const updated = await prisma.clipBrandTemplate.update({
      where: { id },
      data: {
        name: body.name ?? row.name,
        settings: toPrismaJson(nextSettings),
        logoKey: body.logoKey === undefined ? row.logoKey : body.logoKey,
      },
    })
    return NextResponse.json({ data: { template: updated } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const row = await prisma.clipBrandTemplate.findFirst({ where: { id, workspaceId } })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.clipBrandTemplate.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const action = new URL(request.url).searchParams.get('action')
    const prisma = getPrisma()
    if (action === 'set-default') {
      await prisma.$transaction([
        prisma.clipBrandTemplate.updateMany({ where: { workspaceId }, data: { isDefault: false } }),
        prisma.clipBrandTemplate.updateMany({ where: { id, workspaceId }, data: { isDefault: true } }),
      ])
      return NextResponse.json({ data: { ok: true } })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return jsonError(err, 400)
  }
}

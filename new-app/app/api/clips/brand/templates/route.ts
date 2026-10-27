import { NextResponse } from 'next/server'
import { z } from 'zod'
import { brandTemplateSettingsSchema, defaultBrandSettings } from '@/lib/clips/brand'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

const postSchema = z.object({
  name: z.string().min(1).max(120),
  duplicateFromId: z.string().optional(),
  settings: brandTemplateSettingsSchema.partial().optional(),
  logoKey: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const items = await prisma.clipBrandTemplate.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })
    return NextResponse.json({ data: { items } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = postSchema.parse(await request.json())
    const prisma = getPrisma()
    let settings = defaultBrandSettings()
    let logoKey: string | null = null
    let introVideoKey: string | null = null
    let outroVideoKey: string | null = null
    if (body.duplicateFromId) {
      const src = await prisma.clipBrandTemplate.findFirst({
        where: { id: body.duplicateFromId, workspaceId },
      })
      if (!src) throw new Error('Source template not found')
      const base = brandTemplateSettingsSchema.parse(src.settings)
      settings = brandTemplateSettingsSchema.parse({ ...base, ...(body.settings || {}) })
      logoKey = body.logoKey === undefined ? src.logoKey : body.logoKey
      introVideoKey = src.introVideoKey
      outroVideoKey = src.outroVideoKey
    } else if (body.settings) {
      settings = brandTemplateSettingsSchema.parse({ ...defaultBrandSettings(), ...body.settings })
      if (body.logoKey !== undefined) logoKey = body.logoKey
    }
    const row = await prisma.clipBrandTemplate.create({
      data: {
        id: createId('brand'),
        workspaceId,
        name: body.name,
        settings: toPrismaJson(settings),
        logoKey,
        introVideoKey,
        outroVideoKey,
        isDefault: false,
      },
    })
    return NextResponse.json({ data: { template: row } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

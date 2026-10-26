import { NextResponse } from 'next/server'
import { z } from 'zod'
import { brandTemplateSettingsSchema, defaultBrandSettings } from '@/lib/clips/brand'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isDefault: z.boolean().optional(),
  logoKey: z.string().nullable().optional(),
  settings: brandTemplateSettingsSchema.partial().optional(),
})

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const row = await prisma.clipBrandTemplate.findFirst({
      where: { workspaceId, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    })
    const storage = getClipStorage()
    const logoUrl =
      row?.logoKey ? await storage.createSignedDownloadUrl(row.logoKey, 3600).catch(() => null) : null
    return NextResponse.json({ data: { template: row, logoUrl } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function PUT(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = patchSchema.parse(await request.json())
    const prisma = getPrisma()
    let row = await prisma.clipBrandTemplate.findFirst({
      where: { workspaceId, isDefault: true },
    })
    const settings = brandTemplateSettingsSchema.parse({
      ...defaultBrandSettings(),
      ...(row?.settings as object),
      ...(body.settings || {}),
    })
    if (!row) {
      row = await prisma.clipBrandTemplate.create({
        data: {
          id: createId('brand'),
          workspaceId,
          name: body.name || 'Default brand',
          settings,
          logoKey: body.logoKey ?? null,
          isDefault: body.isDefault ?? true,
        },
      })
    } else {
      row = await prisma.clipBrandTemplate.update({
        where: { id: row.id },
        data: {
          name: body.name ?? row.name,
          settings,
          logoKey: body.logoKey === undefined ? row.logoKey : body.logoKey,
          isDefault: body.isDefault ?? row.isDefault,
        },
      })
    }
    return NextResponse.json({ data: { template: row } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

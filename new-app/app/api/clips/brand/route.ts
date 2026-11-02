import { NextResponse } from 'next/server'
import { z } from 'zod'
import { brandTemplateSettingsSchema, defaultBrandSettings } from '@/lib/clips/brand'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

import { brandKitColumnsSchema } from '@/lib/clips/brand-kit'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    isDefault: z.boolean().optional(),
    logoKey: z.string().nullable().optional(),
    settings: brandTemplateSettingsSchema.partial().optional(),
  })
  .merge(brandKitColumnsSchema)

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
    const cols = brandKitColumnsSchema.parse(body)
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
          headingFont: cols.headingFont ?? null,
          captionFont: cols.captionFont ?? null,
          palette: cols.palette ? toPrismaJson(cols.palette) : undefined,
          watermarkKey: cols.watermarkKey ?? null,
          watermarkPosition: cols.watermarkPosition ?? null,
          watermarkOpacity: cols.watermarkOpacity ?? null,
          watermarkSizePct: cols.watermarkSizePct ?? null,
          aspectOverrides: cols.aspectOverrides ? toPrismaJson(cols.aspectOverrides) : undefined,
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
          headingFont: cols.headingFont === undefined ? row.headingFont : cols.headingFont,
          captionFont: cols.captionFont === undefined ? row.captionFont : cols.captionFont,
          palette: cols.palette === undefined ? row.palette : cols.palette ? toPrismaJson(cols.palette) : null,
          watermarkKey: cols.watermarkKey === undefined ? row.watermarkKey : cols.watermarkKey,
          watermarkPosition: cols.watermarkPosition === undefined ? row.watermarkPosition : cols.watermarkPosition,
          watermarkOpacity: cols.watermarkOpacity === undefined ? row.watermarkOpacity : cols.watermarkOpacity,
          watermarkSizePct: cols.watermarkSizePct === undefined ? row.watermarkSizePct : cols.watermarkSizePct,
          aspectOverrides:
            cols.aspectOverrides === undefined
              ? row.aspectOverrides
              : cols.aspectOverrides
                ? toPrismaJson(cols.aspectOverrides)
                : null,
        },
      })
    }
    return NextResponse.json({ data: { template: row } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

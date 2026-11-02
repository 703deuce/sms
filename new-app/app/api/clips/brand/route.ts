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
    id: z.string().optional(),
    name: z.string().min(1).max(120).optional(),
    isDefault: z.boolean().optional(),
    logoKey: z.string().nullable().optional(),
    settings: brandTemplateSettingsSchema.partial().optional(),
  })
  .merge(brandKitColumnsSchema)

export async function GET(req: Request = new Request('http://local/api/clips/brand')) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const id = new URL(req.url).searchParams.get('id')
    const row = id
      ? await prisma.clipBrandTemplate.findFirst({ where: { id, workspaceId } })
      : await prisma.clipBrandTemplate.findFirst({
          where: { workspaceId, isDefault: true },
          orderBy: { updatedAt: 'desc' },
        })
    if (id && !row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
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
    const targetId = body.id

    if (targetId) {
      const existing = await prisma.clipBrandTemplate.findFirst({ where: { id: targetId, workspaceId } })
      if (!existing) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      const settings = brandTemplateSettingsSchema.parse({
        ...defaultBrandSettings(),
        ...(existing.settings as object),
        ...(body.settings || {}),
      })
      const row = await prisma.$transaction(async (tx) => {
        if (body.isDefault === true) {
          await tx.clipBrandTemplate.updateMany({
            where: { workspaceId, id: { not: targetId } },
            data: { isDefault: false },
          })
        }
        return tx.clipBrandTemplate.update({
          where: { id: targetId },
          data: {
            name: body.name ?? existing.name,
            settings,
            logoKey: body.logoKey === undefined ? existing.logoKey : body.logoKey,
            isDefault: body.isDefault ?? existing.isDefault,
            headingFont: cols.headingFont === undefined ? existing.headingFont : cols.headingFont,
            captionFont: cols.captionFont === undefined ? existing.captionFont : cols.captionFont,
            palette:
              cols.palette === undefined
                ? existing.palette
                : cols.palette
                  ? toPrismaJson(cols.palette)
                  : null,
            watermarkKey: cols.watermarkKey === undefined ? existing.watermarkKey : cols.watermarkKey,
            watermarkPosition:
              cols.watermarkPosition === undefined ? existing.watermarkPosition : cols.watermarkPosition,
            watermarkOpacity: cols.watermarkOpacity === undefined ? existing.watermarkOpacity : cols.watermarkOpacity,
            watermarkSizePct:
              cols.watermarkSizePct === undefined ? existing.watermarkSizePct : cols.watermarkSizePct,
            aspectOverrides:
              cols.aspectOverrides === undefined
                ? existing.aspectOverrides
                : cols.aspectOverrides
                  ? toPrismaJson(cols.aspectOverrides)
                  : null,
          },
        })
      })
      return NextResponse.json({ data: { template: row } })
    }

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

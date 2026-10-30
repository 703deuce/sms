import { createId } from '@/lib/supabase/id'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.05).max(1),
  h: z.number().min(0.05).max(1),
})

const bodySchema = z.object({
  channelId: z.string().min(1),
  clipType: z.string().min(1).max(40),
  layoutMode: z.string().min(1).max(40),
  facecam: z
    .object({
      box: boxSchema,
      gameplay: boxSchema.optional(),
      split: z.number().min(0.2).max(0.5).optional(),
      position: z.enum(['top', 'bottom']).optional(),
      pipCorner: z.enum(['TL', 'TR', 'BL', 'BR']).optional(),
    })
    .optional(),
  makeDefault: z.boolean().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id: projectId } = await ctx.params
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const channel = await prisma.streamChannel.findFirst({
      where: { id: body.channelId, workspaceId },
    })
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

    const project = await prisma.clipProject.findFirst({
      where: { id: projectId, workspaceId },
      select: { settings: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const settings = (project.settings ?? {}) as Record<string, unknown>
    const streamer = (settings.streamer ?? {}) as Record<string, unknown>
    const byType = (streamer.clipTypeLayouts ?? {}) as Record<string, unknown>
    const ct = body.clipType.trim().toLowerCase()
    byType[ct] = {
      mode: body.layoutMode,
      facecam: body.facecam ?? null,
      updatedAt: new Date().toISOString(),
    }
    await prisma.clipProject.update({
      where: { id: projectId },
      data: {
        settings: {
          ...settings,
          streamer: { ...streamer, clipTypeLayouts: byType },
        },
      },
    })

    if (body.makeDefault) {
      await prisma.streamLayoutPreset.create({
        data: {
          id: createId('slp'),
          workspaceId,
          channelId: body.channelId,
          name: `Default (${ct})`,
          layout: 'stack',
          facecam: body.facecam?.box ?? undefined,
          gameplay: body.facecam?.gameplay ?? undefined,
          split: body.facecam?.split ?? 0.35,
          facecamPosition: body.facecam?.position ?? 'top',
          source: 'clip_editor',
        },
      })
    }

    return NextResponse.json({ data: { clipType: ct, saved: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

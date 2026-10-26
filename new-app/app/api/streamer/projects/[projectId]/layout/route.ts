import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const layoutBodySchema = z.object({
  layout: z.enum(['stack', 'gameplay', 'camera_follow']),
  facecam: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .nullable()
    .optional(),
  gameplay: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .nullable()
    .optional(),
  split: z.number().min(0.25).max(0.5).optional(),
  facecamPosition: z.enum(['top', 'bottom']).optional(),
  saveAsPreset: z.object({ name: z.string(), makeDefault: z.boolean().optional() }).optional(),
  rerender: z.union([z.literal('all'), z.array(z.string())]).default('all'),
})

export async function GET(request: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const { projectId } = await ctx.params
    const prisma = getPrisma()
    const vod = await prisma.streamVod.findFirst({
      where: { projectId, workspaceId },
      include: { project: { select: { settings: true } } },
    })
    if (!vod) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const state = (vod.state ?? {}) as Record<string, unknown>
    const layout = state.layout ?? null
    const storage = getClipStorage()
    const frameKeys = [0, 1, 2].map((i) => `ws/${workspaceId}/streams/${vod.id}/frames/${i}.jpg`)
    const sampleFrames: string[] = []
    for (const key of frameKeys) {
      try {
        sampleFrames.push(await storage.createSignedDownloadUrl(key, 3600))
      } catch {
        /* optional frames */
      }
    }
    return NextResponse.json({
      data: {
        layout,
        sampleFrames,
        srcW: 1920,
        srcH: 1080,
        presetId: (vod.project.settings as { streamer?: { presetId?: string } })?.streamer?.presetId ?? null,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const { projectId } = await ctx.params
    const body = layoutBodySchema.parse(await request.json())
    const prisma = getPrisma()
    const vod = await prisma.streamVod.findFirst({ where: { projectId, workspaceId } })
    if (!vod) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const state = (vod.state ?? {}) as Record<string, unknown>
    const nextLayout = {
      layout: body.layout,
      facecam: body.facecam,
      gameplay: body.gameplay,
      split: body.split ?? 0.4,
      facecamPosition: body.facecamPosition ?? 'top',
      source: 'manual',
      confidence: 1,
    }
    await prisma.streamVod.update({
      where: { id: vod.id },
      data: { state: { ...state, layout: nextLayout } },
    })
    if (body.saveAsPreset && vod.channelId) {
      const presetId = createId('slp')
      await prisma.streamLayoutPreset.create({
        data: {
          id: presetId,
          workspaceId,
          channelId: vod.channelId,
          name: body.saveAsPreset.name,
          layout: body.layout,
          facecam: body.facecam ?? undefined,
          gameplay: body.gameplay ?? undefined,
          split: body.split ?? 0.4,
          facecamPosition: body.facecamPosition ?? 'top',
          source: 'manual',
        },
      })
      if (body.saveAsPreset.makeDefault) {
        await prisma.streamChannel.update({
          where: { id: vod.channelId },
          data: { defaultPresetId: presetId },
        })
      }
    }
    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId,
        type: 'STREAM_RELAYOUT',
        status: 'QUEUED',
        priority: 8,
        payload: {
          vodId: vod.id,
          clipIds: body.rerender === 'all' ? undefined : body.rerender,
        },
      },
    })
    return NextResponse.json({ data: { ok: true, jobId } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

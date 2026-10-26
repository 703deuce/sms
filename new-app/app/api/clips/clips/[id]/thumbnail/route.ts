import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

const bodySchema = z.object({
  aspect: z.enum(['9:16', '16:9']).default('9:16'),
  titleOverride: z.string().max(80).optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: clip.projectId,
        clipId,
        type: 'THUMBNAIL',
        status: 'QUEUED',
        payload: {
          clipId,
          aspect: body.aspect,
          titleOverride: body.titleOverride || null,
        },
      },
    })

    return NextResponse.json({
      data: {
        jobId,
        estimatedCostUsd: 0.18,
        message: 'Generating 3 thumbnail variants',
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const prisma = getPrisma()
    const rows = await prisma.clipThumbnail.findMany({
      where: { clipId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    })
    const gens = await prisma.aiGeneration.findMany({
      where: { id: { in: rows.map((r: (typeof rows)[number]) => r.generationId) } },
    })
    const genById = new Map(gens.map((g) => [g.id, g]))
    const storage = (await import('@/lib/storage')).getClipStorage()
    const items = await Promise.all(
      rows.map(async (r: (typeof rows)[number]) => {
        const gen = genById.get(r.generationId)
        const key = r.imageKey || gen?.storageKey
        return {
          id: r.id,
          generationId: r.generationId,
          aspect: r.aspect,
          titleText: r.titleText,
          picked: r.picked,
          downloadUrl: key ? await storage.createSignedDownloadUrl(key, 3600) : null,
          status: gen?.status || (key ? 'READY' : 'PENDING'),
        }
      }),
    )
    return NextResponse.json({ data: { items } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

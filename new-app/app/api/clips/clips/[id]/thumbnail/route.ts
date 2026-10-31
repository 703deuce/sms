import { NextResponse } from 'next/server'
import { thumbnailCredits } from '@/lib/clips/credit-cost'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

/** Jobs older than this are not treated as in flight (worker died / stuck). */
const THUMBNAIL_JOB_STALE_MS = 10 * 60 * 1000

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
    // E1fix: a second click while a cover job is still queued/running used to enqueue (and bill)
    // another full job. Return the in-flight job instead.
    const inflight = await prisma.clipJob.findFirst({
      where: {
        clipId,
        projectId: clip.projectId,
        type: 'THUMBNAIL',
        status: { in: ['QUEUED', 'RUNNING'] },
        createdAt: { gte: new Date(Date.now() - THUMBNAIL_JOB_STALE_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (inflight) {
      return NextResponse.json({
        data: {
          jobId: inflight.id,
          alreadyRunning: true,
          credits: 0,
          message: 'Cover generation already running',
        },
      })
    }
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
        credits: thumbnailCredits(),
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
    // E6fix: sign against the driver that actually holds the cover (legacy covers live in Supabase).
    const { createReadableSignedUrl } = await import('@/lib/storage')
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
          downloadUrl: key ? await createReadableSignedUrl(key, 3600).catch(() => null) : null,
          status: gen?.status || (key ? 'READY' : 'PENDING'),
          error: gen?.status === 'FAILED' ? gen.error || 'Image generation failed' : null,
        }
      }),
    )
    // E1fix: expose the recent cover jobs so the panel can show progress and surface failures
    // (before, a job that failed in the worker left the panel silently empty).
    const jobs = await prisma.clipJob.findMany({
      where: { clipId, projectId: clip.projectId, type: 'THUMBNAIL' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, status: true, error: true, createdAt: true, finishedAt: true },
    })
    return NextResponse.json({
      data: {
        items,
        jobs: jobs.map((j: (typeof jobs)[number]) => ({
          id: j.id,
          status: j.status,
          error: j.error,
          createdAt: j.createdAt.toISOString(),
          finishedAt: j.finishedAt ? j.finishedAt.toISOString() : null,
        })),
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { dubCostUsd, DUB_LANGUAGES } from '@/lib/clips/dub'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

const bodySchema = z.object({
  targetLang: z.string().min(2).max(8),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const allowed = new Set(DUB_LANGUAGES.map((l) => l.code))
    if (!allowed.has(body.targetLang)) {
      return NextResponse.json({ error: 'Unsupported language' }, { status: 400 })
    }

    const durationMs = Math.max(1000, clip.endMs - clip.startMs)
    const prisma = getPrisma()
    const trackId = createId('dub')
    await prisma.dubTrack.create({
      data: {
        id: trackId,
        clipId,
        targetLang: body.targetLang,
        status: 'QUEUED',
      },
    })
    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: clip.projectId,
        clipId,
        type: 'DUB',
        status: 'QUEUED',
        payload: { dubTrackId: trackId, targetLang: body.targetLang },
      },
    })

    return NextResponse.json({
      data: {
        dubTrackId: trackId,
        status: 'QUEUED',
        estimatedCostUsd: dubCostUsd(durationMs),
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

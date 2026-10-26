import { NextResponse } from 'next/server'
import { z } from 'zod'
import { musicCostUsd } from '@/lib/clips/audio'
import { normalizeEdits, outputDurationMs } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

const bodySchema = z.object({
  prompt: z.string().min(8).max(2000),
  instrumental: z.boolean().optional().default(true),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const lengthMs = Math.max(3000, Math.min(300_000, outputDurationMs(edits)))

    const prisma = getPrisma()
    const gen = await prisma.aiGeneration.create({
      data: {
        workspaceId,
        clipId,
        kind: 'MUSIC',
        status: 'PENDING',
        provider: 'elevenlabs',
        prompt: body.prompt,
        params: { instrumental: body.instrumental, lengthMs },
      },
    })

    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: clip.projectId,
        clipId,
        type: 'MUSIC',
        status: 'QUEUED',
        payload: { generationId: gen.id, lengthMs, instrumental: body.instrumental, prompt: body.prompt },
      },
    })

    return NextResponse.json({
      data: {
        generationId: gen.id,
        status: 'PENDING',
        estimatedCostUsd: musicCostUsd(lengthMs),
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

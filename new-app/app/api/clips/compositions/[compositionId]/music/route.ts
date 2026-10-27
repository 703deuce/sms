import { NextResponse } from 'next/server'
import { z } from 'zod'
import { musicCostUsd } from '@/lib/clips/audio'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionAudioContext } from '@/lib/server/clips/composition-audio'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

const bodySchema = z.object({
  prompt: z.string().min(8).max(2000),
  instrumental: z.boolean().optional().default(true),
})

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const ctxAudio = await getCompositionAudioContext(workspaceId, compositionId)
    if (!ctxAudio) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const { projectId, clipId, lengthMs } = ctxAudio

    const prisma = getPrisma()
    const gen = await prisma.aiGeneration.create({
      data: {
        workspaceId,
        clipId: clipId ?? undefined,
        kind: 'MUSIC',
        status: 'PENDING',
        provider: 'elevenlabs',
        prompt: body.prompt,
        params: { instrumental: body.instrumental, lengthMs, compositionId },
      },
    })

    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId,
        clipId,
        type: 'MUSIC',
        status: 'QUEUED',
        payload: {
          generationId: gen.id,
          lengthMs,
          instrumental: body.instrumental,
          prompt: body.prompt,
          compositionId,
        },
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

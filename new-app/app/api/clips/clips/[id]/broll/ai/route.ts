import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createVideoTask, kieVideoCostUsd, signGenerationCallback } from '@/lib/server/ai/kie'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  prompt: z.string().min(8).max(2000),
  atMs: z.number().int().min(0),
  durationS: z.number().min(3).max(5),
  resolution: z.enum(['480p', '720p']).optional().default('480p'),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://transovo.ai').replace(/\/$/, '')
    const prisma = getPrisma()

    const gen = await prisma.aiGeneration.create({
      data: {
        workspaceId,
        clipId,
        kind: 'BROLL_VIDEO',
        status: 'PENDING',
        provider: 'kie',
        prompt: body.prompt,
        params: { atMs: body.atMs, durationS: body.durationS, resolution: body.resolution },
      },
    })

    const sig = signGenerationCallback(gen.id)
    const callBackUrl = `${appUrl}/api/clips/kie/callback?g=${encodeURIComponent(gen.id)}&s=${sig}`

    const taskId = await createVideoTask({
      prompt: body.prompt,
      durationS: body.durationS,
      resolution: body.resolution,
      callBackUrl,
    })

    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: { status: 'RUNNING', providerTaskId: taskId },
    })

    return NextResponse.json({
      data: {
        generationId: gen.id,
        status: 'RUNNING',
        estimatedCostUsd: kieVideoCostUsd(body.durationS, body.resolution),
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { musicCostUsd } from '@/lib/clips/audio'
import { kieVideoCostUsd } from '@/lib/clips/kie-cost'
import type { ProducerToolCall } from '@/lib/clips/edits-reducer'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'
import { normalizeEdits, outputDurationMs } from '@/lib/clips/edits'

const bodySchema = z.object({
  tool: z.object({
    name: z.enum(['generate_ai_broll', 'generate_music', 'generate_thumbnail']),
    args: z.record(z.unknown()),
  }),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const tool = body.tool as ProducerToolCall
    const prisma = getPrisma()
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)

    if (tool.name === 'generate_music') {
      const lengthMs = outputDurationMs(edits)
      const gen = await prisma.aiGeneration.create({
        data: {
          workspaceId,
          clipId,
          kind: 'MUSIC',
          status: 'PENDING',
          provider: 'elevenlabs',
          prompt: String(tool.args.prompt || 'upbeat instrumental'),
          params: { instrumental: true, lengthMs },
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
          payload: { generationId: gen.id, lengthMs, instrumental: true },
        },
      })
      return NextResponse.json({
        data: { generationId: gen.id, estimatedCostUsd: musicCostUsd(lengthMs) },
      })
    }

    if (tool.name === 'generate_ai_broll') {
      const durationS = Number(tool.args.durationS || 4)
      const resolution = tool.args.resolution === '720p' ? '720p' : '480p'
      const gen = await prisma.aiGeneration.create({
        data: {
          workspaceId,
          clipId,
          kind: 'BROLL_VIDEO',
          status: 'PENDING',
          provider: 'kie',
          prompt: String(tool.args.prompt || ''),
          params: { durationS, resolution, atMs: Number(tool.args.atMs || 0) },
        },
      })
      return NextResponse.json({
        data: {
          generationId: gen.id,
          estimatedCostUsd: kieVideoCostUsd(durationS, resolution),
        },
      })
    }

    if (tool.name === 'generate_thumbnail') {
      const gen = await prisma.aiGeneration.create({
        data: {
          workspaceId,
          clipId,
          kind: 'THUMBNAIL',
          status: 'PENDING',
          provider: 'kie',
          prompt: String(tool.args.style || 'bold thumbnail'),
          params: { aspect: tool.args.aspect || '9:16', count: 3 },
        },
      })
      const jobId = createId('job')
      await prisma.clipJob.create({
        data: {
          id: jobId,
          projectId: clip.projectId,
          clipId,
          type: 'THUMBNAIL',
          status: 'QUEUED',
          payload: { generationId: gen.id },
        },
      })
      return NextResponse.json({ data: { generationId: gen.id, estimatedCostUsd: 0.18 } })
    }

    return NextResponse.json({ error: 'Unsupported tool' }, { status: 400 })
  } catch (err) {
    return jsonError(err, 400)
  }
}

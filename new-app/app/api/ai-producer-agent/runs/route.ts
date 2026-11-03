import { NextResponse } from 'next/server'
import { z } from 'zod'
import { aiProducerAgentDisabledResponse } from '@/lib/server/ai-producer-agent/api-guard'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createAiProducerAgentRun } from '@/lib/server/ai-producer-agent/runs'

const createSchema = z.object({
  sources: z
    .array(
      z.object({
        sourceId: z.string(),
        kind: z.enum(['stream', 'upload', 'clip']),
        projectId: z.string().optional(),
        clipId: z.string().optional(),
        storageKey: z.string().optional(),
        rangeMs: z.tuple([z.number(), z.number()]).optional(),
        durationMs: z.number().optional(),
        title: z.string().optional(),
      }),
    )
    .min(1),
  outputType: z.enum(['single_payoff', 'montage', 'story', 'auto']),
  genre: z.string().optional(),
  platform: z.enum(['tiktok', 'shorts', 'reels']).optional(),
  targetLengthS: z.tuple([z.number(), z.number()]).optional(),
  music: z.enum(['none', 'library']).optional(),
  memeSfx: z.enum(['off', 'subtle', 'meme']).optional(),
  instruction: z.string().max(4000).optional(),
  exportOnFinish: z.boolean().optional(),
})

export async function POST(request: Request) {
  const disabled = aiProducerAgentDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = createSchema.parse(await request.json())
    const run = await createAiProducerAgentRun(workspaceId, null, body)
    return NextResponse.json({ data: { runId: run.id, status: run.status } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function GET() {
  const disabled = aiProducerAgentDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const { getPrisma } = await import('@/lib/server/db')
    const rows = await getPrisma().aiProducerAgentRun.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        outputType: true,
        resultProjectId: true,
        resultClipId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ data: { runs: rows } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

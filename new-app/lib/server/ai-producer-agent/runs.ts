import 'server-only'

import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { AI_PRODUCER_AGENT_GEMINI_USD_CAP } from '@/lib/ai-producer-agent/flags'
import { runAiProducerAgentLoop } from '@/lib/ai-producer-agent/loop'
import type { AiProducerRunConfig, AiProducerSourceRef } from '@/lib/ai-producer-agent/types'

export type CreateAiProducerRunInput = {
  sources: AiProducerSourceRef[]
  outputType: 'single_payoff' | 'montage'
  genre?: string
  platform?: 'tiktok' | 'shorts' | 'reels'
  targetLengthS?: [number, number]
  music?: 'none' | 'library'
  memeSfx?: 'off' | 'subtle' | 'meme'
  instruction?: string
  exportOnFinish?: boolean
}

export async function assertNoConcurrentRun(workspaceId: string) {
  const active = await getPrisma().aiProducerAgentRun.findFirst({
    where: { workspaceId, status: { in: ['queued', 'running', 'planning', 'applying'] } },
    select: { id: true },
  })
  if (active) throw new Error('ai_producer_agent_run_in_progress')
}

export async function createAiProducerAgentRun(workspaceId: string, userId: string | null, input: CreateAiProducerRunInput) {
  await assertNoConcurrentRun(workspaceId)
  const genre = input.genre ?? 'irl_just_chatting'
  if (genre !== 'irl_just_chatting') throw new Error('genre_not_supported')
  const config: AiProducerRunConfig = {
    targetLengthS: input.targetLengthS ?? (input.outputType === 'montage' ? [30, 60] : [15, 30]),
    music: input.music ?? (input.outputType === 'montage' ? 'library' : 'none'),
    memeSfx: input.memeSfx ?? 'subtle',
    exportOnFinish: Boolean(input.exportOnFinish),
    geminiUsdCap: AI_PRODUCER_AGENT_GEMINI_USD_CAP,
  }
  const id = createId('aprun')
  const row = await getPrisma().aiProducerAgentRun.create({
    data: {
      id,
      workspaceId,
      status: 'queued',
      genre,
      outputType: input.outputType,
      platform: input.platform ?? 'tiktok',
      instruction: input.instruction?.trim() || null,
      config: config as unknown as Prisma.InputJsonValue,
      sourceSnapshot: input.sources as unknown as Prisma.InputJsonValue,
      createdById: userId,
    },
  })
  void runAiProducerAgentLoop(row.id).catch((err) => {
    console.error('[ai-producer-agent] loop failed', row.id, err)
  })
  return row
}

export async function getAiProducerAgentRun(workspaceId: string, runId: string) {
  return getPrisma().aiProducerAgentRun.findFirst({
    where: { id: runId, workspaceId },
    include: { steps: { orderBy: { stepIndex: 'asc' }, take: 200 } },
  })
}

export async function cancelAiProducerAgentRun(workspaceId: string, runId: string) {
  const row = await getPrisma().aiProducerAgentRun.updateMany({
    where: { id: runId, workspaceId, status: { in: ['queued', 'running', 'planning', 'applying'] } },
    data: { status: 'canceled', finishedAt: new Date() },
  })
  return row.count > 0
}

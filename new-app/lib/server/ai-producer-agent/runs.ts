import 'server-only'

import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import type { AiProducerOutputType } from '@/lib/ai-producer-agent/types'
import { AI_PRODUCER_AGENT_GEMINI_USD_CAP } from '@/lib/ai-producer-agent/flags'
import { AI_PRODUCER_MAX_EDITS_PER_RUN } from '@/lib/ai-producer-agent/prompts'
import { defaultTargetLengthS } from '@/lib/ai-producer-agent/decide'
import { runAiProducerAgent } from '@/lib/ai-producer-agent/orchestrator'
import { enqueueAiProducerRunJob } from '@/lib/server/ai-producer-agent/enqueue-run'
import { resolveAiProducerSources } from '@/lib/server/ai-producer-agent/resolve-sources'
import type { AiProducerRunConfig, AiProducerSourceRef } from '@/lib/ai-producer-agent/types'

export type CreateAiProducerRunInput = {
  sources: AiProducerSourceRef[]
  outputType: AiProducerOutputType
  editMode?: 'just_chatting_rough_cut'
  storyMode?: 'single_source_v1' | 'multi_source_story_v1' | 'clean_take_v1'
  roughCutIntent?: 'story' | 'highlights'
  visualEvidenceMode?: 'transcript_baseline' | 'visual_audio'
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
    where: { workspaceId, status: { in: ['queued', 'running', 'planning', 'applying', 'capped'] } },
    select: { id: true },
  })
  if (active) throw new Error('ai_producer_agent_run_in_progress')
}

export async function createAiProducerAgentRun(workspaceId: string, userId: string | null, input: CreateAiProducerRunInput) {
  await assertNoConcurrentRun(workspaceId)
  const genre = input.genre ?? 'irl_just_chatting'
  const multiStory = input.storyMode === 'multi_source_story_v1'
  if (multiStory && ((input.sources.length<2 || input.sources.length>5) ||
      input.outputType!=='story' || input.editMode || input.roughCutIntent ||
      input.music==='library' || input.memeSfx==='meme')) {
    throw new Error('multi_source_story_requires_2_to_5_sources_story_output_and_separate_mode')
  }
  if (genre !== 'irl_just_chatting') throw new Error('genre_not_supported')
  if (input.roughCutIntent && input.editMode !== 'just_chatting_rough_cut') throw new Error('rough_cut_intent_requires_rough_cut_mode')
  if (input.editMode === 'just_chatting_rough_cut' && input.outputType !== 'story') throw new Error('rough_cut_requires_story_output')
  if (input.editMode === 'just_chatting_rough_cut' && input.sources.length !== 1) throw new Error('rough_cut_single_source_only')
  if (input.editMode === 'just_chatting_rough_cut' && input.exportOnFinish) throw new Error('rough_cut_requires_review_before_export')
  if (input.editMode === 'just_chatting_rough_cut' && input.targetLengthS) {
    const [minS, maxS] = input.targetLengthS
    if (!Number.isFinite(minS) || !Number.isFinite(maxS) ||
        minS < 15 || maxS > 900 || maxS < minS) {
      throw new Error('rough_cut_invalid_duration_range')
    }
  }
  const resolvedForConfig =
    input.outputType === 'auto' ? 'single_payoff' : input.outputType === 'story' ? 'story' : input.outputType
  const config: AiProducerRunConfig = {
    editMode: input.editMode,
    ...(multiStory ? { storyMode: 'multi_source_story_v1' as const } : {}),
    roughCutIntent: input.editMode === 'just_chatting_rough_cut' ? input.roughCutIntent ?? 'story' : undefined,
    visualEvidenceMode: multiStory ? 'visual_audio' :
      input.editMode === 'just_chatting_rough_cut' ? input.visualEvidenceMode ?? 'transcript_baseline' : undefined,
    targetLengthS:
      (input.editMode === 'just_chatting_rough_cut' ? input.targetLengthS ?? [180, 480] : input.targetLengthS) ??
      (resolvedForConfig === 'montage'
        ? [30, 60]
        : resolvedForConfig === 'story'
          ? defaultTargetLengthS('story')
          : [15, 30]),
    music:
      multiStory ? 'none' : input.music ??
      (input.editMode === 'just_chatting_rough_cut' ? 'none' : resolvedForConfig === 'montage' || resolvedForConfig === 'story' ? 'library' : 'none'),
    memeSfx: multiStory || input.editMode === 'just_chatting_rough_cut' ? 'off' : input.memeSfx ?? 'subtle',
    exportOnFinish: multiStory ? input.exportOnFinish !== false : Boolean(input.exportOnFinish),
    geminiUsdCap: AI_PRODUCER_AGENT_GEMINI_USD_CAP,
    maxEditsPerRun: multiStory || input.editMode === 'just_chatting_rough_cut' ? 1 : AI_PRODUCER_MAX_EDITS_PER_RUN,
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
  const anchorProjectId = input.sources[0]?.projectId
  try {
    const resolved = await resolveAiProducerSources(workspaceId, input.sources)
    const pid = resolved[0]?.projectId
    if (pid) await enqueueAiProducerRunJob(row.id, pid)
  } catch {
    if (anchorProjectId) await enqueueAiProducerRunJob(row.id, anchorProjectId).catch(() => null)
  }
  queueMicrotask(() => {
    runAiProducerAgent(row.id).catch(async (err) => {
      await getPrisma().aiProducerAgentRun.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          error: String((err as Error)?.message ?? err).slice(0, 2000),
          finishedAt: new Date(),
        },
      })
    })
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

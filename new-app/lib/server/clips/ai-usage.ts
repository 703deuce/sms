import 'server-only'

export type AiUsageRecord = {
  provider: string
  model: string
  units: number
  unitType: string
  costUsdMicros: number
}
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export async function recordAiUsage(input: {
  workspaceId: string
  projectId?: string | null
  clipId?: string | null
  generationId?: string | null
  usage: AiUsageRecord
}) {
  const prisma = getPrisma()
  await prisma.aiUsage.create({
    data: {
      id: createId('aiu'),
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      clipId: input.clipId ?? null,
      generationId: input.generationId ?? null,
      provider: input.usage.provider,
      model: input.usage.model,
      units: input.usage.units,
      unitType: input.usage.unitType,
      costUsdMicros: input.usage.costUsdMicros,
    },
  })
}

/**
 * E6: ai_usage row for an OpenAI JSON call (Producer). Best-effort — never fails the caller.
 */
export async function recordOpenAiJsonUsage(input: {
  workspaceId: string
  projectId?: string | null
  clipId?: string | null
  model: string
  promptTokens: number
  completionTokens: number
}): Promise<void> {
  try {
    const { clipsEditorLlmCostMicros } = await import('@/lib/server/ai/clips-editor-llm')
    await recordAiUsage({
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      clipId: input.clipId ?? null,
      usage: {
        provider: 'openai',
        model: input.model,
        units: input.promptTokens + input.completionTokens,
        unitType: 'tokens',
        costUsdMicros: clipsEditorLlmCostMicros('openai', input.promptTokens, input.completionTokens, input.model),
      },
    })
  } catch (e) {
    console.warn('[clipper:ai-usage] openai_json record_failed', e instanceof Error ? e.message : e)
  }
}

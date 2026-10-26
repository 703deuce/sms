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

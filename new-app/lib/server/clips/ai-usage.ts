import 'server-only'

import type { ElevenLabsUsage } from '@/lib/server/ai/elevenlabs'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export async function recordAiUsage(input: {
  workspaceId: string
  projectId?: string | null
  clipId?: string | null
  generationId?: string | null
  usage: ElevenLabsUsage
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

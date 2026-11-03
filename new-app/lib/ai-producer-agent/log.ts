import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

export async function logAiProducerStep(input: {
  runId: string
  stepIndex: number
  phase?: string
  tool: string
  argsSummary?: string
  resultSummary?: string
  durationMs?: number
  tokensIn?: number
  tokensOut?: number
  estUsd?: number
  error?: string
}) {
  await getPrisma().aiProducerAgentStep.create({
    data: {
      id: createId('apstep'),
      runId: input.runId,
      stepIndex: input.stepIndex,
      phase: input.phase,
      tool: input.tool,
      argsSummary: input.argsSummary?.slice(0, 4000),
      resultSummary: input.resultSummary?.slice(0, 4000),
      durationMs: input.durationMs,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      estUsd: input.estUsd,
      error: input.error?.slice(0, 2000),
    },
  })
}

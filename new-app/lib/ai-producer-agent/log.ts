import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

export async function logAiProducerStep(input: {
  runId: string
  stepIndex: number
  phase?: string
  tool: string
  kind?: 'luna' | 'tool' | 'validate' | 'system'
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

export function redactArgs(args: unknown): unknown {
  if (args == null || typeof args !== 'object') return args
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    if (typeof v === 'string' && (v.includes('?') || v.includes('X-Amz'))) {
      out[k] = v.split('?')[0] + '?…'
    } else {
      out[k] = v
    }
  }
  return out
}

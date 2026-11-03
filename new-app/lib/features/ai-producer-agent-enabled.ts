const TRUTHY = new Set(['1', 'true', 'on', 'yes'])

/** AI Producer Agent v1 — default off (NEXT_PUBLIC for UI, server/worker mirror). */
export function isAiProducerAgentEnabledFromEnv(env: {
  NEXT_PUBLIC_AI_PRODUCER_AGENT?: string
  AI_PRODUCER_AGENT_ENABLED?: string
}): boolean {
  for (const raw of [env.NEXT_PUBLIC_AI_PRODUCER_AGENT, env.AI_PRODUCER_AGENT_ENABLED]) {
    const v = (raw ?? '').trim().toLowerCase()
    if (TRUTHY.has(v)) return true
  }
  return false
}

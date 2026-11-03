import { isAiProducerAgentEnabledFromEnv } from '@/lib/features/ai-producer-agent-enabled'

export function aiProducerAgentPublicEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return isAiProducerAgentEnabledFromEnv({
      NEXT_PUBLIC_AI_PRODUCER_AGENT: process.env.NEXT_PUBLIC_AI_PRODUCER_AGENT,
    })
  }
  return aiProducerAgentServerEnabled()
}

export function aiProducerAgentServerEnabled(): boolean {
  return isAiProducerAgentEnabledFromEnv({
    NEXT_PUBLIC_AI_PRODUCER_AGENT: process.env.NEXT_PUBLIC_AI_PRODUCER_AGENT,
    AI_PRODUCER_AGENT_ENABLED: process.env.AI_PRODUCER_AGENT_ENABLED,
  })
}

export const AI_PRODUCER_AGENT_LABEL = 'AI Producer: New edit'

export const AI_PRODUCER_AGENT_GEMINI_USD_CAP =
  Number(process.env.AI_PRODUCER_AGENT_GEMINI_USD_CAP ?? '3') || 3

export const AI_PRODUCER_AGENT_MAX_STEPS = Math.min(
  80,
  Math.max(1, Number(process.env.AI_PRODUCER_AGENT_MAX_STEPS ?? '40') || 40),
)

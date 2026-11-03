import {
  buildAgentSystemPromptForModel,
  type AgentOutputType,
  type AgentPromptContext,
} from '@/lib/ai-producer-agent/prompts'

export {
  AI_PRODUCER_MAX_EDITS_PER_RUN,
  buildAgentSystemPrompt,
  buildAgentSystemPromptForModel,
  type AgentOutputType,
  type AgentPromptContext,
} from '@/lib/ai-producer-agent/prompts'

export function assertGenreSupported(genre: string) {
  if (genre !== 'irl_just_chatting') throw new Error('genre_not_supported')
}

/** Back-compat wrapper around the full stacked system prompt. */
export function loadRulepackSections(ctx: {
  genre: string
  outputType: AgentOutputType
  platform: string
}) {
  const system = buildAgentSystemPromptForModel({
    genre: ctx.genre,
    outputType: ctx.outputType,
    platform: ctx.platform as AgentPromptContext['platform'],
  })
  return { system, template: '' }
}

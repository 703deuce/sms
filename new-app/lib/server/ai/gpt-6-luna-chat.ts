import 'server-only'

export const GPT_6_LUNA_MODEL_ID = 'gpt-6-luna'

export function isGpt6FamilyModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith('gpt-6')
}

export function lunaReasoningEffort(): 'none' | 'low' | 'medium' | 'high' {
  const raw = (process.env.OPENAI_REASONING_EFFORT || 'none').trim().toLowerCase()
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw
  return 'none'
}

/** Extra Chat Completions fields for gpt-6* (no custom temperature). */
export function gpt6ChatCompletionExtras(model: string): Record<string, unknown> {
  if (!isGpt6FamilyModel(model)) {
    return { temperature: 0.4 }
  }
  return {
    reasoning_effort: lunaReasoningEffort(),
    max_completion_tokens: 4096,
  }
}

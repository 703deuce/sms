import 'server-only'
import { clipsEditorJsonWithGeminiFallback } from '@/lib/server/ai/clips-editor-llm'

/**
 * Customer-facing conversation layer. NEVER receives webhook credentials or model/vendor
 * implementation details. It cannot claim an edit was applied: only jobs/tools can.
 */
export type AssistantDecision = { intent: 'question' | 'edit' | 'clarify'; reply: string; instruction: string }
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['question', 'edit', 'clarify'] },
    reply: { type: 'string' },
    instruction: { type: 'string' },
  },
  required: ['intent', 'reply', 'instruction'],
}
const SYSTEM = `You are Transovo AI Assistant, an explicitly AI-powered customer-facing video editing assistant.
You understand a customer's existing video and discuss specific changes naturally. You NEVER identify
internal vendor/model names or speculate about system implementation. You are not a human.
Classify the customer's most recent message:
- "question": question about the project or general video-editing concepts; provide a grounded, concise answer.
- "clarify": ambiguous creative change that cannot be executed precisely; ask ONE concrete question.
- "edit": unambiguous instruction requesting an actual production or timeline change. Put a concise, specific
  instruction in "instruction", preserving user intent, selected context and approved brand.
DO NOT claim you changed, rendered, saved, or queued anything. Those are confirmed only by the backend.
If project details are unavailable, say so rather than inventing facts.
Do not include secrets, providers, internal model details, credit costs, or unwarranted guarantees.
Return JSON only.`
export async function interpretCustomerMessage(input: {
  message: string; title: string; status: string; phase: string; currentTimeMs?: number
  selectedElementIds: string[]; recent: { role: string; text: string }[]; brand?: unknown
}): Promise<AssistantDecision> {
  try {
    const user = JSON.stringify({
      message: input.message, project: { title: input.title, status: input.status, phase: input.phase,
        selectedTimeMs: input.currentTimeMs, selectedElementIds: input.selectedElementIds, brand: input.brand },
      conversation: input.recent.slice(-10),
    })
    const result = await clipsEditorJsonWithGeminiFallback<AssistantDecision>({
      context: 'motion_studio_customer_assistant', system: SYSTEM, user: user.slice(0, 18000),
      responseSchema: RESPONSE_SCHEMA, maxOutputTokens: 400,
    })
    const data = result.data
    if (!data || !['question','edit','clarify'].includes(data.intent)) throw new Error('Invalid intent')
    return { intent: data.intent, reply: typeof data.reply === 'string' ? data.reply.slice(0, 1200) : '',
      instruction: typeof data.instruction === 'string' ? data.instruction.slice(0, 2500) : input.message }
  } catch {
    // Fail closed: never trigger a costly edit when understanding fails.
    return { intent: 'clarify', reply: 'I couldn’t reliably interpret that request. Could you tell me exactly what you want changed?',
      instruction: '' }
  }
}

import 'server-only'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { applyT2vProducerTools, T2V_PRODUCER_TOOL_NAMES, type T2vProducerToolCall } from '@/lib/server/t2v/producer-tools'

export const T2V_PRODUCER_SYSTEM = `You are the Transovo Text-to-Video assistant (Magic Box). Return JSON:
{ "reply": string, "tools": [{ "name": string, "args": object }] }
Allowed tools: ${T2V_PRODUCER_TOOL_NAMES.join(', ')}.
sceneId can be scene id or 1-based scene number as string.
Use set_voice with voiceId when the user names a voice; use rewrite_scene for narration edits.
Use rebuild when the user asks to build/render the video after edits.
Keep reply to 1-3 short sentences.`

export async function runT2vProducerTurn(input: {
  document: T2vDraftV1
  userMessage: string
  voiceCatalog?: string
}): Promise<{ reply: string; tools: T2vProducerToolCall[] }> {
  const sceneList = input.document.scenes
    .map((s, i) => `${i + 1}. id=${s.id} narration=${s.narration.slice(0, 80)}… visual=${s.visualQuery}`)
    .join('\n')
  const user = [
    `Title: ${input.document.title}`,
    `Aspect: ${input.document.settings.aspect} · Voice: ${input.document.voice?.voiceName ?? 'default'}`,
    input.voiceCatalog ? `Available voices (name=voiceId): ${input.voiceCatalog}` : '',
    `Scenes:\n${sceneList}`,
    `User: ${input.userMessage}`,
  ].join('\n\n')
  const out = await openAiJsonResponse<{ reply: string; tools: T2vProducerToolCall[] }>(T2V_PRODUCER_SYSTEM, user)
  return {
    reply: out.reply || 'Done.',
    tools: Array.isArray(out.tools) ? out.tools : [],
  }
}

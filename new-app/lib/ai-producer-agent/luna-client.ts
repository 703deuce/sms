import 'server-only'

import { GPT_6_LUNA_MODEL_ID, gpt6ChatCompletionExtras } from '@/lib/server/ai/gpt-6-luna-chat'
import type { ToolSchema } from '@/lib/ai-producer-agent/tools/schemas'

export type LunaToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
export type LunaMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LunaToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }
export type LunaUsage = { prompt_tokens: number; completion_tokens: number }
export type LunaFn = (req: {
  messages: LunaMessage[]
  tools: ToolSchema[]
  toolChoice: 'auto' | 'required'
}) => Promise<{ message: Extract<LunaMessage, { role: 'assistant' }>; usage?: LunaUsage }>

let impl: LunaFn | null = null

export function __setLunaImpl(fn: LunaFn | null) {
  impl = fn
}

async function withRetry<T>(fn: () => Promise<T>, delays: number[]): Promise<T> {
  let last: unknown
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i < delays.length) await new Promise((r) => setTimeout(r, delays[i]))
    }
  }
  throw last
}

export const lunaChat: LunaFn = async (req) => {
  if (impl) return impl(req)
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const model = GPT_6_LUNA_MODEL_ID
  const r = await withRetry(async () => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: req.messages,
        tools: req.tools.map((t) => ({ type: 'function', function: t })),
        tool_choice: req.toolChoice,
        parallel_tool_calls: false,
        max_completion_tokens: 4096,
        ...gpt6ChatCompletionExtras(model),
      }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) {
      const t = await res.text()
      if (res.status === 429 || res.status >= 500) throw new Error(t)
      throw new Error(`luna ${res.status}: ${t.slice(0, 400)}`)
    }
    return res.json() as Promise<{
      choices?: Array<{ message?: { content?: string | null; tool_calls?: LunaToolCall[] } }>
      usage?: LunaUsage
    }>
  }, [2000, 6000])
  const m = r.choices?.[0]?.message
  return {
    message: { role: 'assistant', content: m?.content ?? null, tool_calls: m?.tool_calls },
    usage: r.usage,
  }
}

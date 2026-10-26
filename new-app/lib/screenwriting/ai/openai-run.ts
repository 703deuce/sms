import OpenAI from 'openai'
import type { AiJobKind } from '@/lib/screenwriting/ai/estimate'

function client() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not configured')
  return new OpenAI({ apiKey: key })
}

const PROMPTS: Record<AiJobKind, string> = {
  assist: 'You are a screenwriting assistant. Improve the selected passage for clarity and punch. Return only the revised text.',
  scene_feedback:
    'You are a story analyst. Give concise scene feedback: goal, conflict, turn, pacing, dialogue. Use bullet points.',
  character_feedback: 'Analyze character voice consistency and arc across the script excerpt. Bullet points.',
  coverage:
    'Write indie script coverage: logline, synopsis, strengths, weaknesses, grid (Premise/Structure/Characters/Dialogue/Pacing), verdict Pass/Consider/Recommend.',
  synopsis_long: 'Write a 2-page synopsis suitable for producers. Prose paragraphs.',
}

export async function runSwOpenAi(kind: AiJobKind, inputText: string): Promise<{ text: string; model: string }> {
  const openai = client()
  const model = process.env.SW_OPENAI_MODEL || 'gpt-4o-mini'
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: PROMPTS[kind] },
      { role: 'user', content: inputText.slice(0, 120_000) },
    ],
    temperature: 0.4,
  })
  const text = res.choices[0]?.message?.content?.trim() || ''
  return { text, model }
}

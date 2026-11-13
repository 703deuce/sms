import 'server-only'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import type { T2vNarrationSegment, T2vPipelineStyle, T2vStoryPlan } from '@/lib/t2v/pipeline/t2v-types'

/** Words per second used for planning only. Actual ElevenLabs audio timing drives the edit. */
export const T2V_PLAN_WORDS_PER_S = 2.45
/** Seconds reserved for the closing end card (no narration). */
export const T2V_END_CARD_S = 2.5

const STYLE_GUIDE: Record<T2vPipelineStyle, string> = {
  documentary: 'Documentary: calm authority, vivid concrete imagery, measured pacing, a sense of discovery.',
  educational: 'Educational: clear step-by-step explanation, simple language, one idea per sentence.',
  explainer: 'Explainer: friendly and direct, answers "why" and "how", uses everyday examples.',
  marketing: 'Marketing: benefit-led, confident and warm, ends with a clear call to action.',
  social: 'Social: punchy, energetic, short sentences, strong hook in the first line.',
}

export function wordBudget(durationS: number): number {
  return Math.max(40, Math.round(Math.max(10, durationS - T2V_END_CARD_S) * T2V_PLAN_WORDS_PER_S))
}

const STORY_SYSTEM = `You are the Story Planner for an automatic stock-footage video maker.
Understand the user's request and plan a coherent narrative with a beginning, middle and end.
Return ONLY JSON:
{"title": string, "topic": string, "audience": string, "tone": string, "hook": string,
 "keyPoints": string[], "ending": string, "musicMood": string}
Rules:
- title: <= 8 words, no clickbait punctuation.
- topic: 2-5 concrete words naming the subject (used to keep footage on topic).
- keyPoints: 3-7 points in logical order; each must be something stock footage can show.
- ending: how the video lands (conclusion or call to action).
- musicMood: 3-8 words describing instrumental background music (no vocals).
- Do not fabricate specific statistics, dates, names or quotations. Prefer well-established,
  general facts; if unsure, describe trends qualitatively.`

export async function t2vStoryAgent(input: {
  prompt: string
  style: T2vPipelineStyle
  durationS: number
}): Promise<T2vStoryPlan> {
  const user = [
    `User request: ${input.prompt.slice(0, 4000)}`,
    `Style: ${STYLE_GUIDE[input.style]}`,
    `Target runtime: about ${input.durationS} seconds.`,
  ].join('\n')
  const out = await openAiJsonResponse<Partial<T2vStoryPlan>>(STORY_SYSTEM, user)
  const keyPoints = (Array.isArray(out.keyPoints) ? out.keyPoints : []).map((k) => String(k).trim()).filter(Boolean)
  if (!keyPoints.length) throw new Error('t2v_story_empty')
  return {
    title: String(out.title ?? '').trim().slice(0, 90) || 'AI Video',
    topic: String(out.topic ?? '').trim().slice(0, 80),
    audience: String(out.audience ?? 'general audience').trim().slice(0, 120),
    tone: String(out.tone ?? input.style).trim().slice(0, 80),
    hook: String(out.hook ?? '').trim().slice(0, 300),
    keyPoints: keyPoints.slice(0, 8),
    ending: String(out.ending ?? '').trim().slice(0, 300),
    targetSeconds: input.durationS,
    musicMood: String(out.musicMood ?? 'subtle cinematic instrumental').trim().slice(0, 80),
  }
}

const SCRIPT_SYSTEM = `You are the Script Writer for an automatic stock-footage video maker.
Write the complete spoken narration from the story plan. Return ONLY JSON:
{"segments": [{"purpose": string, "narration": string, "visualMeaning": string, "emotion": string}]}
Rules:
- 4-9 segments: segment 1 is the hook/opening, the last segment is the ending.
- narration: natural spoken English that sounds good read aloud by a narrator. Short, complete
  sentences of 7-18 words each (every sentence becomes its own on-screen shot). 2-5 sentences per
  segment. No stage directions, no emojis, no headings, no "in this video".
- Every sentence must describe something a camera could show (people, places, objects, actions),
  so stock footage can illustrate it. Avoid purely abstract sentences.
- Flow naturally between segments; no repetition; satisfying final sentence.
- visualMeaning: what the viewer should see during this segment.
- Total words across all narration MUST be within +-8% of the word budget.
- Do not fabricate specific statistics, dates, names or quotations.`

export async function t2vScriptAgent(input: {
  story: T2vStoryPlan
  style: T2vPipelineStyle
  durationS: number
  prompt: string
}): Promise<T2vNarrationSegment[]> {
  const budget = wordBudget(input.durationS)
  const user = [
    `Original request: ${input.prompt.slice(0, 2000)}`,
    `Style: ${STYLE_GUIDE[input.style]}`,
    `Story plan: ${JSON.stringify(input.story)}`,
    `Word budget: ${budget} words total (~${input.durationS - T2V_END_CARD_S}s of narration).`,
  ].join('\n')
  const out = await openAiJsonResponse<{ segments?: Array<Record<string, unknown>> }>(SCRIPT_SYSTEM, user)
  const segs = (Array.isArray(out.segments) ? out.segments : [])
    .map((s, i) => ({
      id: `seg_${i + 1}`,
      purpose: String(s.purpose ?? '').trim().slice(0, 120),
      narration: String(s.narration ?? '').replace(/\s+/g, ' ').trim(),
      visualMeaning: String(s.visualMeaning ?? '').trim().slice(0, 300),
      emotion: String(s.emotion ?? '').trim().slice(0, 60),
      targetSeconds: 0,
    }))
    .filter((s) => s.narration.length > 0)
  if (!segs.length) throw new Error('t2v_script_empty')
  for (const s of segs) {
    s.targetSeconds = Math.round((s.narration.split(/\s+/).length / T2V_PLAN_WORDS_PER_S) * 10) / 10
  }
  return segs
}

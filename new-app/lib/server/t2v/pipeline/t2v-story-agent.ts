import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { logT2v } from '@/lib/server/t2v/log'
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

/**
 * Words per second of FINISHED video (narration plus the short pauses between shots), calibrated on the
 * Nov 13 EV runs: 226 words -> 97.9 s, 236 words -> 105.6 s (about 2.3 words/s after the end card).
 * Used only for the script's word budget, so a 90 s target lands close to 90 s.
 */
export const T2V_EDIT_WORDS_PER_S = 2.3
/** More than this over budget triggers one tightening rewrite. */
export const T2V_BUDGET_TOLERANCE = 0.05

export function wordBudget(durationS: number): number {
  return Math.max(40, Math.round(Math.max(10, durationS - T2V_END_CARD_S) * T2V_EDIT_WORDS_PER_S))
}

export function narrationWords(segs: Array<{ narration: string }>): number {
  return segs.reduce((n, s) => n + (s.narration.trim() ? s.narration.trim().split(/\s+/).length : 0), 0)
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
  const out = await t2vLlmJson<Partial<T2vStoryPlan>>(STORY_SYSTEM, user)
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
- Total words across all narration MUST NOT exceed the word budget; aim for 95-100% of it.
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
  const out = await t2vLlmJson<{ segments?: Array<Record<string, unknown>> }>(SCRIPT_SYSTEM, user)
  let segs = toSegments(out.segments)
  if (!segs.length) throw new Error('t2v_script_empty')
  segs = await tightenToBudget(segs, budget)
  segs = await expandToBudget(segs, budget)
  for (const s of segs) {
    s.targetSeconds = Math.round((s.narration.split(/\s+/).length / T2V_PLAN_WORDS_PER_S) * 10) / 10
  }
  return segs
}

function toSegments(raw: unknown): T2vNarrationSegment[] {
  return (Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [])
    .map((s, i) => ({
      id: `seg_${i + 1}`,
      purpose: String(s.purpose ?? '').trim().slice(0, 120),
      narration: String(s.narration ?? '').replace(/\s+/g, ' ').trim(),
      visualMeaning: String(s.visualMeaning ?? '').trim().slice(0, 300),
      emotion: String(s.emotion ?? '').trim().slice(0, 60),
      targetSeconds: 0,
    }))
    .filter((s) => s.narration.length > 0)
}

const TIGHTEN_SYSTEM = `You tighten a narration script for a stock-footage video so it fits its running time.
Return ONLY JSON: {"segments": [{"purpose": string, "narration": string, "visualMeaning": string, "emotion": string}]}
Rules:
- Keep the same segments in the same order with the same purpose, meaning and ending.
- Cut words, not ideas: drop filler, merge or shorten sentences. Keep sentences 7-18 words, natural to read aloud.
- Total narration words MUST be at or just under the target given. Never add new facts.`

const EXPAND_SYSTEM = `You lengthen a narration script for a stock-footage video so it fills its running time.
Return ONLY JSON: {"segments": [{"purpose": string, "narration": string, "visualMeaning": string, "emotion": string}]}
Rules:
- Keep the same segments in the same order with the same purpose and ending.
- Add concrete, filmable detail (what a camera would show) - a short extra sentence or a richer clause - never
  filler, never new statistics, dates, names or quotations. Sentences 7-18 words, natural to read aloud.
- Total narration words MUST be at or just under the target given.`

/**
 * One expansion rewrite when the script is more than 5% under budget (mirror of the tightening rewrite;
 * a 90 s target otherwise finishes at ~85 s). Kept only if closer to budget and not over it by >10%.
 */
export async function expandToBudget(segs: T2vNarrationSegment[], budget: number): Promise<T2vNarrationSegment[]> {
  const words = narrationWords(segs)
  if (words >= budget * (1 - T2V_BUDGET_TOLERANCE)) return segs
  try {
    const out = await t2vLlmJson<{ segments?: Array<Record<string, unknown>> }>(
      EXPAND_SYSTEM,
      `Target: ${budget} words total (currently ${words}).\nScript: ${JSON.stringify(segs.map(({ purpose, narration, visualMeaning, emotion }) => ({ purpose, narration, visualMeaning, emotion })))}`,
    )
    const next = toSegments(out.segments)
    const n = narrationWords(next)
    if (next.length && n <= budget * 1.1 && Math.abs(n - budget) < Math.abs(words - budget)) {
      logT2v('pipeline-script', 'expanded to budget', { budget, before: words, after: n })
      return next
    }
    logT2v('pipeline-script', 'expansion rejected', { budget, before: words, after: n })
  } catch (err) {
    logT2v('pipeline-script', 'expansion failed (keeping original)', { error: err instanceof Error ? err.message : 'error' })
  }
  return segs
}

/**
 * One tightening rewrite when the script runs more than 5% over its word budget (a 90 s target otherwise
 * finishes at 100+ s). Kept only if it is closer to budget and not drastically short; never fails the run.
 */
export async function tightenToBudget(segs: T2vNarrationSegment[], budget: number): Promise<T2vNarrationSegment[]> {
  const words = narrationWords(segs)
  if (words <= budget * (1 + T2V_BUDGET_TOLERANCE)) return segs
  try {
    const out = await t2vLlmJson<{ segments?: Array<Record<string, unknown>> }>(
      TIGHTEN_SYSTEM,
      `Target: ${budget} words total (currently ${words}).\nScript: ${JSON.stringify(segs.map(({ purpose, narration, visualMeaning, emotion }) => ({ purpose, narration, visualMeaning, emotion })))}`,
    )
    const next = toSegments(out.segments)
    const n = narrationWords(next)
    if (next.length && n >= budget * 0.85 && Math.abs(n - budget) < Math.abs(words - budget)) {
      logT2v('pipeline-script', 'tightened to budget', { budget, before: words, after: n })
      return next
    }
    logT2v('pipeline-script', 'tightening rejected', { budget, before: words, after: n })
  } catch (err) {
    logT2v('pipeline-script', 'tightening failed (keeping original)', { error: err instanceof Error ? err.message : 'error' })
  }
  return segs
}

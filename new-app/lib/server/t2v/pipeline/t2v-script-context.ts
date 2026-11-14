import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { compactScript } from '@/lib/server/t2v/pipeline/t2v-reimagine'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vPlannedShot, T2vStoryPlan } from '@/lib/t2v/pipeline/t2v-types'

/**
 * Script-context pass (Prompt-to-Video only): ONE LLM call after pacing. The model reads the whole script and
 * writes, in its own words, what the video is about and, per shot (split pieces included), what that moment
 * means, the one thing a viewer must recognise and a few ways to show it. No enumerated attributes or rules:
 * context is the model reading the script. Non-fatal: on failure the planner's briefs are kept as they are.
 */
export const SCRIPT_CONTEXT_SYSTEM = `You are the editor of a stock-footage video. Read the WHOLE script below first, then explain it to the
footage team so every shot fits this video and this moment in it.

Return ONLY JSON:
{"videoUnderstanding": string,
 "lines": [{"lineNo": number, "moment": string, "mustRecognise": string, "showIdeas": string[]}]}

- videoUnderstanding: 2-4 plain sentences in your own words: what this video is about, who is watching and
  what situation they are in, and what the footage should feel like overall. Describe only what the script
  actually implies; do not invent details it does not support.
- moment (per line): one sentence on what THIS line means at THIS point of the video, read together with
  the lines before and after it (what the viewer is doing, where they are, what they should feel). If a line
  deliberately moves somewhere new, say so.
- mustRecognise: 2-5 words naming the one thing a viewer must be able to recognise on screen for the shot to
  work (an object, place or activity). Do not add hands, people, camera angles or placement unless the line
  is about them.
- showIdeas: 3 different ways a real editor could show this moment with common stock footage, most direct
  first, then a less literal one that still clearly carries the same moment. Each 4-12 words.
- If a line says NOT to do something, the ideas must show the safe alternative, never the warned-against act.`

const clean = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const cleanQuery = (q: string) => q.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

export type T2vScriptContext = { videoUnderstanding: string; shots: T2vPlannedShot[] }

/** Apply the model's per-line output to the shots (lineNo = 1-based shot order). */
export function applyScriptContext(
  shots: T2vPlannedShot[],
  out: { videoUnderstanding?: unknown; lines?: Array<Record<string, unknown>> },
): T2vScriptContext {
  const byLine = new Map<number, Record<string, unknown>>()
  for (const l of Array.isArray(out.lines) ? out.lines : []) byLine.set(Number(l.lineNo), l)
  const next = shots.map((s, i) => {
    const l = byLine.get(i + 1)
    if (!l) return s
    const moment = clean(l.moment, 400)
    const must = clean(l.mustRecognise, 80)
    const ideas = (Array.isArray(l.showIdeas) ? l.showIdeas : []).map((x) => clean(x, 120)).filter(Boolean).slice(0, 3)
    // The planner's queries are still searched first; the two most direct ideas seed extra queries.
    const seeds = ideas.slice(0, 2).map(cleanQuery).filter((q) => q.length > 2)
    return {
      ...s,
      ...(moment ? { moment } : {}),
      ...(must ? { subject: must } : {}),
      ...(ideas.length ? { showIdeas: ideas } : {}),
      queries: [...new Set([...s.queries, ...seeds])],
    }
  })
  return { videoUnderstanding: clean(out.videoUnderstanding, 1200), shots: next }
}

export async function t2vScriptContext(story: Pick<T2vStoryPlan, 'title'>, shots: T2vPlannedShot[]): Promise<T2vScriptContext> {
  try {
    const user = `Title: ${story.title}\nScript (numbered, one line per shot):\n${compactScript(shots)}`
    const out = await t2vLlmJson<{ videoUnderstanding?: unknown; lines?: Array<Record<string, unknown>> }>(SCRIPT_CONTEXT_SYSTEM, user, { maxTokens: 6000 })
    const res = applyScriptContext(shots, out)
    logT2v('pipeline-context', 'script context', { shots: shots.length, withMoment: res.shots.filter((s) => s.moment).length })
    return res
  } catch (err) {
    logT2v('pipeline-context', 'script context failed, planner briefs kept', { error: err instanceof Error ? err.message : 'error' })
    return { videoUnderstanding: '', shots }
  }
}

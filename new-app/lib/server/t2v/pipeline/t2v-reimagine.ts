import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import type { T2vPlannedShot, T2vShotResult, T2vStoryPlan } from '@/lib/t2v/pipeline/t2v-types'

/**
 * REIMAGINE (Prompt-to-Video only). When search + verify found no good stock clip for a line, the LLM reads
 * the whole script, the line and what was tried (queries, what the reviewer saw and why it failed) and
 * proposes alternative shot ideas that carry the same moment or theme. Each idea is searched and verified
 * like a normal shot. Bounded: at most T2V_REIMAGINE_ROUNDS rounds (default and max 2), one LLM call per round,
 * at most T2V_REIMAGINE_MAX_SCENES lines and T2V_REIMAGINE_IDEAS ideas per line per round; no retries.
 */
function envInt(name: string, fallback: number, max: number): number {
  const v = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fallback
}
export const T2V_REIMAGINE_ROUNDS = envInt('T2V_REIMAGINE_ROUNDS', 2, 2)
export const T2V_REIMAGINE_MAX_SCENES = envInt('T2V_REIMAGINE_MAX_SCENES', 10, 30)
export const T2V_REIMAGINE_IDEAS = envInt('T2V_REIMAGINE_IDEAS', 3, 3)

export type T2vShotIdea = { intent: string; mustRecognise: string; queries: string[] }

export const REIMAGINE_SYSTEM = `You help the editor of a stock-footage video. For each line below, nothing found so far fits. Read the whole
script first so you understand the video and what each line's moment needs to say.

For each line propose 3 ALTERNATIVE shots that carry the same moment in a different way and that are filmed
constantly as stock footage. Think like an editor who cannot get the literal shot: show a related part of the
same activity, its result, its setting, its tools, the person's reaction, or a detail that implies it. Example
of the thinking (not a rule): a line about racing with no raceway footage -> a pit-stop crew changing tyres,
a driver pulling on a helmet, a close-up of a revving tachometer.

Use what was tried and why the reviewer rejected it (fit_reason) to avoid the same dead ends. Never propose
something that would look out of place in this video, and if the line warns against an act, show the safe
alternative, never the act.

Each idea:
- intent: one plain sentence describing the shot.
- mustRecognise: 2-5 words, the one thing the viewer must recognise (no hands or placement unless essential).
- queries: 3 stock search phrases of 1-3 common words; never a query already tried.
Return ONLY JSON: {"lines": [{"sceneId": string, "ideas": [{"intent": string, "mustRecognise": string,
"queries": string[]}]}]}`

/** Numbered whole script for prompts (each line trimmed, total capped). */
export function compactScript(shots: Array<Pick<T2vPlannedShot, 'narration'>>, maxChars = 8000): string {
  return shots
    .map((s, i) => `${i + 1}. ${s.narration.replace(/\s+/g, ' ').trim().slice(0, 200)}`)
    .join('\n')
    .slice(0, maxChars)
}

/** Reimagined shots verify under `${sceneId}~i${k}`; results map back to the line's own scene id. */
export const baseSceneId = (id: string) => id.split('~')[0]!

export function ideaShots(base: T2vPlannedShot, ideas: T2vShotIdea[]): T2vPlannedShot[] {
  return ideas.map((d, k) => ({ ...base, sceneId: `${base.sceneId}~i${k}`, intent: d.intent, subject: d.mustRecognise, queries: d.queries }))
}

const clean = (q: unknown) => String(q ?? '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

export async function t2vReimagine(input: {
  story: T2vStoryPlan
  allShots: T2vPlannedShot[]
  targets: T2vPlannedShot[]
  tried: Record<string, string[]>
  history: Record<string, T2vShotResult>
}): Promise<Record<string, T2vShotIdea[]>> {
  if (!input.targets.length) return {}
  const lines = input.targets.map((s) => ({
    sceneId: s.sceneId,
    lineNo: input.allShots.findIndex((x) => x.sceneId === s.sceneId) + 1,
    line: s.narration,
    moment: s.moment || s.intent,
    tried: (input.tried[s.sceneId] ?? []).slice(-15),
    rejected: (input.history[s.sceneId]?.evaluated ?? [])
      .filter((e) => e.visible)
      .slice(-6)
      .map((e) => ({ showed: String(e.visible).slice(0, 100), score: e.score ?? null, why: String(e.fitReason ?? '').slice(0, 120) })),
  }))
  const user = [
    `Title: ${input.story.title}`,
    `Topic: ${input.story.topic || input.story.title}`,
    `What this video is about: ${input.story.videoUnderstanding || '(not available)'}`,
    `Whole script:\n${compactScript(input.allShots)}`,
    `Lines: ${JSON.stringify(lines)}`,
  ].join('\n')
  const out = await t2vLlmJson<{ lines?: Array<{ sceneId?: string; ideas?: Array<Record<string, unknown>> }> }>(REIMAGINE_SYSTEM, user, { maxTokens: 4000 })
  const res: Record<string, T2vShotIdea[]> = {}
  const wanted = new Set(input.targets.map((s) => s.sceneId))
  for (const l of Array.isArray(out.lines) ? out.lines : []) {
    if (!l.sceneId || !wanted.has(l.sceneId)) continue
    const tried = new Set((input.tried[l.sceneId] ?? []).map((q) => q.toLowerCase()))
    const ideas = (Array.isArray(l.ideas) ? l.ideas : [])
      .map((d) => ({
        intent: String(d.intent ?? '').trim().slice(0, 300),
        mustRecognise: clean(d.mustRecognise),
        queries: [...new Set((Array.isArray(d.queries) ? d.queries : []).map(clean).filter((q) => q.length > 2 && !tried.has(q.toLowerCase())))].slice(0, 3),
      }))
      .filter((d) => d.intent && d.mustRecognise && d.queries.length)
      .slice(0, T2V_REIMAGINE_IDEAS)
    if (ideas.length) res[l.sceneId] = ideas
  }
  return res
}

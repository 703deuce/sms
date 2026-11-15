import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { compactScript } from '@/lib/server/t2v/pipeline/t2v-reimagine'
import { logT2v } from '@/lib/server/t2v/log'
import { parseSetting } from '@/lib/server/t2v/pipeline/t2v-setting'
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
 "lines": [{"lineNo": number, "moment": string,
   "setting": {"timeOfDay": "day"|"night"|"morning"|"evening"|"any", "place": "indoor"|"outdoor"|"any",
               "where": string, "mood": string},
   "lineShows": string, "mustRecognise": string, "showIdeas": string[], "searches": string[]}]}

- videoUnderstanding: 2-4 plain sentences in your own words: what this video is about, who is watching and
  what situation they are in, and what the footage should feel like overall. Describe only what the script
  actually implies; do not invent details it does not support.
- moment (per line): one sentence on what THIS line means at THIS point of the video, read together with
  the lines before and after it (what the viewer is doing, where they are, what they should feel). If a line
  deliberately moves somewhere new, say so.
- setting (per line): the setting THIS moment implies for the footage, inferred from the video's topic and the
  lines around it, not only from this line's own words. timeOfDay and place: what a viewer of this video would
  expect at this point ("any" only when the script truly leaves it open); where: 1-3 words for the kind of
  place, '' when open; mood: 1-4 words. A generic word in a line (an activity, a drink, a place, a person) is
  read through the video: it means the version that fits this video's situation at this moment, so its setting
  is that situation's time of day, place and mood. If a line deliberately moves somewhere new, the setting
  moves with it.
- lineShows: in a few plain words, what a viewer should literally SEE on screen for what THIS line means (if
  the line is part of a sentence, read the whole sentence but describe THIS part): the visible thing plus the
  action the line asks for or describes, or its result. When the line advises stopping, avoiding or reducing
  something, lineShows is the advised action or its result, not the thing to stop. When the line names
  something abstract (a routine, a habit, a plan, a feeling), lineShows is ONE concrete everyday example of it
  that a viewer would recognise at a glance. lineShows always fits the line's setting: when the time of day,
  indoor/outdoor or place would be visible in the shot, name it (never a version that contradicts the setting).
- mustRecognise: 2-5 words naming the one thing a viewer must be able to recognise on screen for the shot to
  work (an object, place or activity). Do not add hands, people, camera angles or placement unless the line
  is about them.
- showIdeas: 3 different ways a real editor could show this moment with common stock footage, most direct
  first, then a less literal one that still clearly carries the same moment. Each 4-12 words.
- searches: 4 short stock-video search queries for lineShows, the way a stock site tags footage: usually 2
  words, 3 at most: the main visible object or subject plus its action or place (e.g. "locking door",
  "opening window", "watering plants"). Every query names the object the line is about; do not spend words on
  who does it (person, woman), on filler or on mood. Each query a DIFFERENT literal phrasing: another
  everyday word for the object, the action, or its visible result. Where the video's setting would be visible
  in the shot, at least one query names it (e.g. the place or "night"), and no query may describe a version
  that contradicts the line's setting.
- showIdeas stay inside the line's setting too.
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
    const lineShows = clean(l.lineShows, 160)
    // Literal keyword searches for what the viewer should see go FIRST (search and checker share the target);
    // the planner's queries follow. Long sentence-like ideas are not searched (Pixabay tags are 1-3 words).
    const searches = parseSearches(l)
    const setting = parseSetting(l.setting)
    const seeds = searches.length ? [] : ideas.slice(0, 2).map(cleanQuery).filter((q) => q.length > 2)
    return {
      ...s,
      ...(moment ? { moment } : {}),
      ...(lineShows ? { lineShows } : {}),
      ...(must ? { subject: must } : {}),
      ...(ideas.length ? { showIdeas: ideas } : {}),
      ...(setting ? { setting } : {}),
      queries: [...new Set([...searches, ...s.queries, ...seeds])],
    }
  })
  return { videoUnderstanding: clean(out.videoUnderstanding, 1200), shots: next }
}

function parseSearches(l: Record<string, unknown>): string[] {
  return (Array.isArray(l.searches) ? l.searches : [])
    .map((x) => cleanQuery(String(x ?? '')).toLowerCase())
    .filter((q) => q.length > 2 && q.split(' ').length <= 4)
    .slice(0, 4)
}

/**
 * Every shot leaves planning with a FIXED lineShows: the checker judges every clip of the line against this one
 * text and never writes its own (sleep #1194: 40 different line_shows over 57 checks of one line). A line the
 * model skipped gets the planner's intent (still one fixed text per line). Reimagine idea shots inherit it.
 */
export function fixLineShows(shots: T2vPlannedShot[]): { shots: T2vPlannedShot[]; fallback: string[] } {
  const fallback: string[] = []
  const out = shots.map((s) => {
    if (s.lineShows?.trim()) return s
    fallback.push(s.sceneId)
    return { ...s, lineShows: clean(s.intent || s.narration, 160) }
  })
  return { shots: out, fallback }
}

/**
 * Frozen plans (planned before lineShows existed, e.g. a reset --from-footage draft): write lineShows ONCE for
 * the lines that have none, and put that line's literal searches first in its queries. Moments, subjects and
 * everything else of the frozen plan stay as they are. The caller persists the result on the run.
 */
export async function t2vLineShowsOnce(story: Pick<T2vStoryPlan, 'title'>, shots: T2vPlannedShot[]): Promise<{ shots: T2vPlannedShot[]; fromModel: number; fallback: string[] }> {
  if (shots.every((s) => s.lineShows?.trim())) return { shots, fromModel: 0, fallback: [] }
  let lines: Array<Record<string, unknown>> = []
  try {
    const user = `Title: ${story.title}\nScript (numbered, one line per shot):\n${compactScript(shots)}`
    const out = await t2vLlmJson<{ lines?: Array<Record<string, unknown>> }>(SCRIPT_CONTEXT_SYSTEM, user, { maxTokens: 8000 })
    lines = Array.isArray(out.lines) ? out.lines : []
  } catch (err) {
    logT2v('pipeline-context', 'line shows failed, planner intent used', { error: err instanceof Error ? err.message : 'error' })
  }
  const byLine = new Map<number, Record<string, unknown>>()
  for (const l of lines) byLine.set(Number(l.lineNo), l)
  let fromModel = 0
  const next = shots.map((s, i) => {
    if (s.lineShows?.trim()) return s
    const l = byLine.get(i + 1)
    const lineShows = l ? clean(l.lineShows, 160) : ''
    if (!lineShows) return s
    fromModel++
    return { ...s, lineShows, queries: [...new Set([...parseSearches(l!), ...s.queries])] }
  })
  const fixed = fixLineShows(next)
  logT2v('pipeline-context', 'line shows fixed (frozen plan, once)', { shots: shots.length, fromModel, fallback: fixed.fallback.length })
  return { shots: fixed.shots, fromModel, fallback: fixed.fallback }
}

/**
 * Frozen plans written before the implied setting existed: write each line's setting ONCE (same prompt; only
 * `setting` is taken, every other field of the frozen plan stays). Non-fatal; the caller persists the result.
 */
export async function t2vSettingsOnce(story: Pick<T2vStoryPlan, 'title'>, shots: T2vPlannedShot[]): Promise<{ shots: T2vPlannedShot[]; fromModel: number }> {
  if (!shots.some((s) => !s.setting)) return { shots, fromModel: 0 }
  try {
    const user = `Title: ${story.title}\nScript (numbered, one line per shot):\n${compactScript(shots)}`
    const out = await t2vLlmJson<{ lines?: Array<Record<string, unknown>> }>(SCRIPT_CONTEXT_SYSTEM, user, { maxTokens: 8000 })
    const res = applySettingsOnly(shots, Array.isArray(out.lines) ? out.lines : [])
    logT2v('pipeline-context', 'settings written (frozen plan, once)', { shots: shots.length, fromModel: res.fromModel })
    return res
  } catch (err) {
    logT2v('pipeline-context', 'settings failed, plan kept', { error: err instanceof Error ? err.message : 'error' })
    return { shots, fromModel: 0 }
  }
}

/** Only the `setting` of each model line, for shots that have none (lineNo = 1-based shot order). */
export function applySettingsOnly(shots: T2vPlannedShot[], lines: Array<Record<string, unknown>>): { shots: T2vPlannedShot[]; fromModel: number } {
  const byLine = new Map<number, Record<string, unknown>>()
  for (const l of lines) byLine.set(Number(l.lineNo), l)
  let fromModel = 0
  const next = shots.map((s, i) => {
    if (s.setting) return s
    const setting = parseSetting(byLine.get(i + 1)?.setting)
    if (!setting) return s
    fromModel++
    return { ...s, setting }
  })
  return { shots: next, fromModel }
}

export async function t2vScriptContext(story: Pick<T2vStoryPlan, 'title'>, shots: T2vPlannedShot[]): Promise<T2vScriptContext> {
  try {
    const user = `Title: ${story.title}\nScript (numbered, one line per shot):\n${compactScript(shots)}`
    const out = await t2vLlmJson<{ videoUnderstanding?: unknown; lines?: Array<Record<string, unknown>> }>(SCRIPT_CONTEXT_SYSTEM, user, { maxTokens: 8000 })
    const res = applyScriptContext(shots, out)
    logT2v('pipeline-context', 'script context', { shots: shots.length, withMoment: res.shots.filter((s) => s.moment).length, withSetting: res.shots.filter((s) => s.setting).length })
    return res
  } catch (err) {
    logT2v('pipeline-context', 'script context failed, planner briefs kept', { error: err instanceof Error ? err.message : 'error' })
    return { videoUnderstanding: '', shots }
  }
}

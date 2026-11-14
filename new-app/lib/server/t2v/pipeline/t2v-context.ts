/**
 * Video "scene world": a free-form description of the world the whole video lives in, written once per
 * video by the story LLM (topic, viewer and their situation, implied setting / time / season / mood, what
 * is plausible and implausible on screen). Each line also gets an "implied situation" from the planner.
 * Gemini verify judges every candidate against it (contextFit 0-10 + reason); the planner, fallbacks and
 * AI b-roll prompts get the same text. No keyword lists: the model decides what fits.
 */
import type { T2vSceneWorld } from '@/lib/t2v/pipeline/t2v-types'

/** Gemini contextFit bars: accepted picks need 6+, any pick (fallback, photo, last resort) 5+. */
export const CONTEXT_FIT_ACCEPT = 6
export const CONTEXT_FIT_MIN = 5

export const SCENE_WORLD_JSON = `"world": {"summary": string, "viewer": string, "situation": string, "setting": string,
  "timeOfDay": string, "season": string, "mood": string, "plausible": string[], "implausible": string[],
  "fallbackQueries": string[], "searchTerms": string}`

export const SCENE_WORLD_RULES = `- world: the visual world the WHOLE video lives in, so every stock shot feels like part of one story.
  summary: 1-2 sentences. viewer: who is watching and their situation. setting / timeOfDay / season / mood:
  what the topic implies ("" when it implies nothing; never invent daylight). plausible: 3-6 kinds of shots
  that belong in this video; implausible: 3-6 kinds of shots that would look wrong here even if a word
  matches (a winter storm video: no summer beach or sunny barbecue; a kids' video: no bars or nightlife).
  fallbackQueries: 3 short stock search phrases (1-3 words) for neutral on-world B-roll (e.g. "snowy house",
  "cozy winter interior"). searchTerms: 1-2 words appended to EVERY stock search so results stay in this
  world (e.g. "winter", "night bedroom"); "" when the world implies nothing visual.`

const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const list = (v: unknown, n: number, max = 80) =>
  [...new Set((Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean))].slice(0, n)

/** LLM JSON → scene world; undefined when the model returned nothing usable (pipeline runs as before). */
export function normalizeSceneWorld(raw: unknown, topic: string): T2vSceneWorld | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const w: T2vSceneWorld = {
    topic: str(topic, 80),
    summary: str(o.summary, 400),
    viewer: str(o.viewer, 200),
    situation: str(o.situation, 200),
    setting: str(o.setting, 120),
    timeOfDay: str(o.timeOfDay, 60),
    season: str(o.season, 60),
    mood: str(o.mood, 80),
    plausible: list(o.plausible, 6),
    implausible: list(o.implausible, 6),
    searchTerms: str(o.searchTerms, 30).replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' '),
    fallbackQueries: list(o.fallbackQueries, 3, 40).map((q) => q.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()).filter((q) => q.length > 2),
  }
  return w.summary || w.setting || w.implausible.length ? w : undefined
}

/** Appends the world's search terms to a stock query unless it already carries them ("door handle" -> "door handle winter"). */
export function worldQuery(q: string, w: T2vSceneWorld | undefined): string {
  const terms = (w?.searchTerms ?? '').toLowerCase().split(' ').filter(Boolean)
  const have = new Set(q.toLowerCase().split(/\s+/))
  const add = terms.filter((t) => !have.has(t))
  return add.length ? `${q} ${add.join(' ')}`.slice(0, 80) : q
}

/** Multi-line world description for prompts ('' without a world). */
export function worldPrompt(w: T2vSceneWorld | undefined): string {
  if (!w) return ''
  const rows: Array<[string, string]> = [
    ['Video world', w.summary],
    ['Viewer', w.viewer],
    ['Viewer situation', w.situation],
    ['Setting', w.setting],
    ['Time of day', w.timeOfDay],
    ['Season', w.season],
    ['Mood', w.mood],
    ['Plausible shots', w.plausible.join('; ')],
    ['Implausible shots (off-world)', w.implausible.join('; ')],
  ]
  return rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')
}

/** One-line world summary for short prompts (planner rows, AI b-roll, spare re-checks). */
export function worldLine(w: T2vSceneWorld | undefined): string {
  if (!w) return ''
  const parts = [w.summary, w.setting, w.timeOfDay, w.season, w.mood].filter(Boolean)
  const avoid = w.implausible.length ? `; off-world: ${w.implausible.join(', ')}` : ''
  return `${parts.join('; ')}${avoid}`.slice(0, 600)
}

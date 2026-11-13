import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import type { T2vNarrationSegment, T2vPlannedShot, T2vStoryPlan } from '@/lib/t2v/pipeline/t2v-types'
import { T2V_PLAN_WORDS_PER_S } from '@/lib/server/t2v/pipeline/t2v-story-agent'

/** Split narration into sentences without changing a single word. */
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [text]
  const out: string[] = []
  for (const raw of parts) {
    const s = raw.trim()
    if (!s) continue
    // Merge fragments under 5 words into the previous sentence (keeps shots >= ~2 s).
    if (out.length && s.split(/\s+/).length < 5) out[out.length - 1] = `${out[out.length - 1]} ${s}`
    else out.push(s)
  }
  return out
}

export function estimateNeedS(sentence: string): number {
  const words = sentence.trim().split(/\s+/).length
  return Math.round((words / T2V_PLAN_WORDS_PER_S + 0.4) * 10) / 10
}

const PLANNER_SYSTEM = `You are the Scene Planner for an automatic stock-footage video maker.
Every narration sentence gets exactly ONE stock video shot. The script drives the visuals.
Return ONLY JSON: {"shots": [{"index": number, "intent": string, "queries": string[], "onScreenText": string}]}
Rules for each shot:
- intent: one plain sentence describing what generic stock B-roll should show while that sentence is
  spoken (subject + action, optional setting). Keep it achievable with common stock footage: do not
  require a time of day, weather, specific brand, specific people, or several things happening at once
  unless the narration itself depends on it.
- queries: exactly 3 stock-video search phrases of 1-3 common words each, using the concrete nouns a stock
  site would tag the clip with (e.g. "electric car charging", "charging station", "car highway").
  Query 1 is the most specific, query 3 a broader on-topic fallback (e.g. "electric car", "city traffic").
  Never use abstract words (concept, future, innovation, appeal, growth, choice) or verbs like "pulls in".
- Plan visual variety: neighbouring shots should show different subjects, framings (aerial, wide,
  close-up, people, detail) and settings. Never plan the same visual twice in a row.
- onScreenText: "" for almost every shot; at most 3 shots in the whole video may carry a 2-5 word
  caption-free headline when a key point is introduced.`

export async function t2vScenePlanner(input: {
  story: T2vStoryPlan
  segments: T2vNarrationSegment[]
}): Promise<T2vPlannedShot[]> {
  const rows: Array<{ index: number; segmentId: string; narration: string }> = []
  for (const seg of input.segments) {
    for (const sentence of splitSentences(seg.narration)) {
      rows.push({ index: rows.length + 1, segmentId: seg.id, narration: sentence })
    }
  }
  if (!rows.length) throw new Error('t2v_planner_no_sentences')
  const user = [
    `Video topic: ${input.story.topic || input.story.title}`,
    `Title: ${input.story.title}`,
    `Segments (purpose / what the viewer should see): ${JSON.stringify(
      input.segments.map((s) => ({ id: s.id, purpose: s.purpose, visualMeaning: s.visualMeaning })),
    )}`,
    `Sentences (one shot each): ${JSON.stringify(rows)}`,
  ].join('\n')
  const out = await t2vLlmJson<{ shots?: Array<Record<string, unknown>> }>(PLANNER_SYSTEM, user)
  const byIndex = new Map<number, Record<string, unknown>>()
  for (const s of Array.isArray(out.shots) ? out.shots : []) byIndex.set(Number(s.index), s)
  const topic = (input.story.topic || input.story.title).toLowerCase()
  return rows.map((row, i) => {
    const s = byIndex.get(row.index) ?? {}
    const queries = (Array.isArray(s.queries) ? s.queries : [])
      .map((q) => String(q).replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80))
      .filter((q) => q.length > 2)
    if (queries.length < 3) queries.push(`${topic}`.slice(0, 80))
    const ost = String(s.onScreenText ?? '').trim()
    return {
      sceneId: `sc_${i}_${Math.random().toString(36).slice(2, 8)}`,
      segmentId: row.segmentId,
      narration: row.narration,
      intent: String(s.intent ?? row.narration).trim().slice(0, 300),
      queries: [...new Set(queries)].slice(0, 3),
      needS: estimateNeedS(row.narration),
      ...(ost && ost.split(/\s+/).length <= 6 ? { onScreenText: ost } : {}),
    }
  })
}

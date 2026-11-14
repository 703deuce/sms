import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import type { T2vNarrationSegment, T2vPipelineStyle, T2vPlannedShot, T2vStoryPlan } from '@/lib/t2v/pipeline/t2v-types'
import { planPacing, T2V_BEATS, validPieces, type T2vBeat, type T2vPacingRow } from '@/lib/server/t2v/pipeline/t2v-pacing'
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

const PLANNER_SYSTEM = `You are the Scene Planner and editor for an automatic stock-footage video maker.
The script drives the visuals. For every narration sentence return its editorial beat, the stock shot that
illustrates it, and - for longer sentences - natural places a real editor could cut to a second or third shot.
Return ONLY JSON: {"shots": [{"index": number, "beat": string, "intent": string, "subject": string,
"queries": string[], "onScreenText": string, "pieces": [{"text": string, "intent": string, "subject": string,
"queries": string[]}]}]}
Rules for each sentence:
- beat: one of establishing (sets a place), aerial, emotional (a moment to feel), detail (a close look),
  step (one step of a process), list (one of several items), action (something happening fast), transition.
- intent: one plain sentence describing what generic stock B-roll should show (subject + action, optional
  setting). Achievable with common stock footage; no time of day, weather, brand or specific people unless
  the narration depends on it.
- subject: the SPECIFIC subject the clip must show, 1-4 words, as named in the line (e.g. "coffee cherries",
  "coffee roaster drum", "coffee beans on drying beds") - never a generic category ("fruit", "machine").
- queries: exactly 3 stock-video search phrases of 1-3 common words (concrete nouns a stock site would tag).
  Query 1 most specific, query 3 a broader on-topic fallback. No abstract words.
- pieces: only for sentences of 10+ words: split the sentence into 2-3 contiguous pieces at natural pauses
  (commas, "and", "while", "then", clause boundaries). The pieces' text joined with spaces must reproduce the
  sentence EXACTLY, word for word. Each piece >= 4 words and shows a DIFFERENT visual, with its own intent,
  subject and 3 queries. Omit or use [] when the sentence reads as one continuous image.
- Plan visual variety: neighbouring shots should differ in subject, framing and setting.
- onScreenText: "" for almost every shot; at most 3 shots may carry a 2-5 word headline.`

export type PlannerSentenceRow = { index: number; segmentId: string; narration: string }

function cleanQueries(raw: unknown, fallback: string): string[] {
  const queries = (Array.isArray(raw) ? raw : [])
    .map((q) => String(q).replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80))
    .filter((q) => q.length > 2)
  if (queries.length < 3) queries.push(fallback.slice(0, 80))
  return [...new Set(queries)].slice(0, 3)
}

function asBeat(v: unknown): T2vBeat {
  const b = String(v ?? '').toLowerCase().trim()
  return (T2V_BEATS as readonly string[]).includes(b) ? (b as T2vBeat) : 'detail'
}

/** Planner JSON → pacing rows (pieces validated verbatim against the sentence). */
export function toPacingRows(rows: PlannerSentenceRow[], shots: Array<Record<string, unknown>>, topic: string): T2vPacingRow[] {
  const byIndex = new Map<number, Record<string, unknown>>()
  for (const s of shots) byIndex.set(Number(s.index), s)
  return rows.map((row) => {
    const s = byIndex.get(row.index) ?? {}
    const intent = String(s.intent ?? row.narration).trim().slice(0, 300)
    const subject = String(s.subject ?? '').trim().slice(0, 60) || intent.slice(0, 60)
    const ost = String(s.onScreenText ?? '').trim()
    const pieces = validPieces(
      row.narration,
      (Array.isArray(s.pieces) ? (s.pieces as Array<Record<string, unknown>>) : []).map((p) => ({
        text: String(p.text ?? '').trim(),
        intent: String(p.intent ?? '').trim().slice(0, 300),
        subject: String(p.subject ?? '').trim().slice(0, 60),
        queries: cleanQueries(p.queries, topic),
      })),
    )
    return {
      segmentId: row.segmentId,
      narration: row.narration,
      beat: asBeat(s.beat),
      intent,
      subject,
      queries: cleanQueries(s.queries, topic),
      ...(ost && ost.split(/\s+/).length <= 6 ? { onScreenText: ost } : {}),
      ...(pieces ? { pieces } : {}),
    }
  })
}

export async function t2vScenePlanner(input: {
  story: T2vStoryPlan
  segments: T2vNarrationSegment[]
  style: T2vPipelineStyle
  /** Per-video pacing seed (draft id + start time), so two videos never share one cut pattern. */
  seed: string
}): Promise<T2vPlannedShot[]> {
  const rows: PlannerSentenceRow[] = []
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
    `Sentences: ${JSON.stringify(rows)}`,
  ].join('\n')
  const out = await t2vLlmJson<{ shots?: Array<Record<string, unknown>> }>(PLANNER_SYSTEM, user, { maxTokens: 8000 })
  const topic = (input.story.topic || input.story.title).toLowerCase()
  const paced = planPacing(toPacingRows(rows, Array.isArray(out.shots) ? out.shots : [], topic), { style: input.style, seed: input.seed })
  return paced.map((p, i) => ({
    sceneId: `sc_${i}_${Math.random().toString(36).slice(2, 8)}`,
    segmentId: p.segmentId,
    narration: p.narration,
    intent: p.intent,
    queries: p.queries,
    needS: p.needS,
    beat: p.beat,
    subject: p.subject,
    voiceGroup: p.voiceGroup,
    wordOffset: p.wordOffset,
    sentence: p.sentence,
    ...(p.onScreenText ? { onScreenText: p.onScreenText } : {}),
  }))
}

import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { logT2v } from '@/lib/server/t2v/log'
import { FILLER_MIN_SCORE } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import type { T2vPlannedShot, T2vReimagineLogEntry, T2vReimaginePending, T2vShotResult, T2vStoryPlan } from '@/lib/t2v/pipeline/t2v-types'

/**
 * REIMAGINE (Prompt-to-Video only). When search + verify found no good stock clip for a line, the LLM reads
 * the whole script, the line and what was tried (queries, what the reviewer saw and why it failed) and
 * proposes alternative shot ideas that carry the same moment or theme. Each idea is searched and verified
 * like a normal shot.
 *
 * PER SCENE: every line where no candidate reaches FILLER_MIN_SCORE (5/10) gets its own reimagine rounds,
 * at most T2V_REIMAGINE_ROUNDS per line (default and max 2), T2V_REIMAGINE_IDEAS ideas per line per round.
 * There is no cap on how many lines are reimagined: a round's lines are batched T2V_REIMAGINE_BATCH per LLM
 * call (calls run together), so every failing line is included. No retries of a failed call.
 */
function envInt(name: string, fallback: number, max: number): number {
  const v = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fallback
}
export const T2V_REIMAGINE_ROUNDS = envInt('T2V_REIMAGINE_ROUNDS', 2, 2)
/** Lines per reimagine LLM call (keeps each answer inside its token budget); NOT a cap on lines. */
export const T2V_REIMAGINE_BATCH = Math.max(1, envInt('T2V_REIMAGINE_BATCH', 8, 15))
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

/**
 * The full sentence a shot belongs to (split scenes: "and adjust bedding" alone reads like a keyword list).
 * Uses the planner's `sentence`, else joins the narration of the shots sharing its voiceGroup.
 */
export function fullSentence(all: Array<Pick<T2vPlannedShot, 'sceneId' | 'narration' | 'voiceGroup' | 'sentence'>>, i: number): string {
  const s = all[i]
  if (!s) return ''
  if (s.sentence?.trim()) return s.sentence.trim()
  if (!s.voiceGroup) return s.narration
  return all
    .filter((x) => x.voiceGroup === s.voiceGroup)
    .map((x) => x.narration.trim())
    .join(' ')
}

/** Scene context for verify and reimagine: full sentence plus the neighbouring lines (story order). */
export function sceneContext(all: Array<Pick<T2vPlannedShot, 'sceneId' | 'narration' | 'voiceGroup' | 'sentence'>>, sceneId: string) {
  const i = all.findIndex((x) => x.sceneId === baseSceneId(sceneId))
  return {
    lineNo: i >= 0 ? i + 1 : null,
    sentence: i >= 0 ? fullSentence(all, i) : '',
    prevNarration: i > 0 ? all[i - 1]!.narration : '',
    nextNarration: i >= 0 ? (all[i + 1]?.narration ?? '') : '',
  }
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
  const lines = input.targets.map((s) => {
    const ctx = sceneContext(input.allShots, s.sceneId)
    return {
    sceneId: s.sceneId,
    lineNo: ctx.lineNo ?? 0,
    line: s.narration,
    // A piece of a split sentence is read with its whole sentence and neighbours, never alone.
    ...(ctx.sentence && ctx.sentence !== s.narration ? { fullSentence: ctx.sentence } : {}),
    previousLine: ctx.prevNarration,
    nextLine: ctx.nextNarration,
    moment: s.moment || s.intent,
    tried: (input.tried[s.sceneId] ?? []).slice(-15),
    rejected: (input.history[s.sceneId]?.evaluated ?? [])
      .filter((e) => e.seen || e.visible)
      .slice(-6)
      .map((e) => ({ showed: String(e.seen || e.visible).slice(0, 100), score: e.score ?? null, why: String(e.fitReason ?? '').slice(0, 120) })),
    }
  })
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

/** Lines that still get a reimagine round: failing now and fewer than `maxRounds` rounds done for that line. */
export function reimagineTargets<T extends { sceneId: string }>(failing: T[], tries: Record<string, number>, maxRounds = T2V_REIMAGINE_ROUNDS): T[] {
  return failing.filter((s) => (tries[s.sceneId] ?? 0) < maxRounds)
}

/**
 * Every target line gets ideas: targets are split into batches of T2V_REIMAGINE_BATCH, one LLM call each,
 * run together. A failed batch only leaves its own lines without ideas this round (logged, never retried).
 */
export async function t2vReimagineAll(input: Parameters<typeof t2vReimagine>[0], batch = T2V_REIMAGINE_BATCH): Promise<Record<string, T2vShotIdea[]>> {
  const chunks: T2vPlannedShot[][] = []
  for (let i = 0; i < input.targets.length; i += batch) chunks.push(input.targets.slice(i, i + batch))
  const settled = await Promise.allSettled(chunks.map((targets) => t2vReimagine({ ...input, targets })))
  const out: Record<string, T2vShotIdea[]> = {}
  settled.forEach((r, k) => {
    if (r.status === 'fulfilled') Object.assign(out, r.value)
    else logT2v('pipeline-reimagine', 'batch failed', { sceneIds: chunks[k]!.map((s) => s.sceneId), error: r.reason instanceof Error ? r.reason.message.slice(0, 200) : 'error' })
  })
  return out
}

/**
 * One log entry per line per round: the ideas (intent + queries), every candidate the reviewer scored for
 * each idea, the best score and whether the line now has a clip at FILLER_MIN_SCORE+ from this round.
 * Idea results arrive under `${sceneId}~i${k}`; k is the idea index in `pending`.
 */
export function reimagineOutcomes(pending: T2vReimaginePending, results: T2vShotResult[]): T2vReimagineLogEntry[] {
  const byId = new Map((results ?? []).filter(Boolean).map((r) => [r.sceneId, r]))
  return Object.entries(pending).map(([sceneId, p]) => {
    let best: number | null = null
    const ideas = p.ideas.map((d, k) => {
      const ev = byId.get(`${sceneId}~i${k}`)?.evaluated ?? []
      const candidates = ev
        .filter((e) => e.providerId && e.providerId !== '-')
        .map((e) => {
          const score = !e.error && typeof e.score === 'number' ? e.score : null
          if (score !== null && (best === null || score > best)) best = score
          return { providerId: e.providerId, score }
        })
      return { idea: `${sceneId}~i${k}`, intent: d.intent, queries: d.queries, candidates }
    })
    const passed = best !== null && best >= FILLER_MIN_SCORE
    const note = !p.ideas.length ? 'no_ideas' : ideas.every((d) => !d.candidates.length) ? 'no_candidates' : undefined
    return { sceneId, round: p.round, ideas, bestScore: best, passed, ...(note ? { note } : {}) }
  })
}

export function logReimagineOutcomes(draftId: string, entries: T2vReimagineLogEntry[]) {
  for (const e of entries) logT2v('pipeline-reimagine', 'round', { draftId, ...e })
}

/** One line's clip availability in the full pick pass (what the edit would really place). */
export type T2vReimagineFailing<T> = {
  shot: T
  /** Own reviewed clips (no error) the reviewer scored FILLER_MIN_SCORE+ for this line. */
  ownAt5: number
  /** Why each of those is not available: used_by:<sceneId>, banned_by_sequence_check, or not_placeable (style/sequence rules). */
  blocked: Array<{ providerId: string; score: number; reason: string }>
}

/**
 * Lines with no AVAILABLE clip at FILLER_MIN_SCORE+ in the full pick pass: nothing placed, or only a
 * last_resort (style-rule) pick. Clips taken by another line or banned as look-alikes do not count as
 * available, so such a line is reimagined instead of silently extending the previous shot.
 */
export function reimagineFailing<T extends { sceneId: string }>(
  shots: T[],
  history: Record<string, T2vShotResult>,
  pass: { results: Record<string, T2vShotResult>; tiers: Record<string, string>; banned: Record<string, string[]> },
): Array<T2vReimagineFailing<T>> {
  const owner = new Map<string, string>()
  for (const s of shots) {
    const id = pass.results[s.sceneId]?.chosen?.providerId
    if (id) owner.set(id, s.sceneId)
  }
  const out: Array<T2vReimagineFailing<T>> = []
  for (const s of shots) {
    const placed = pass.results[s.sceneId]?.chosen
    if (placed && pass.tiers[s.sceneId] !== 'last_resort') continue
    const banned = new Set(pass.banned[s.sceneId] ?? [])
    const own = (history[s.sceneId]?.evaluated ?? []).filter((e) => !e.error && typeof e.score === 'number' && e.score >= FILLER_MIN_SCORE)
    const blocked = own
      .filter((e) => e.providerId !== placed?.providerId)
      .map((e) => {
        const by = owner.get(e.providerId)
        const reason = by && by !== s.sceneId ? `used_by:${by}` : banned.has(e.providerId) ? 'banned_by_sequence_check' : 'not_placeable'
        return { providerId: e.providerId, score: e.score as number, reason }
      })
    out.push({ shot: s, ownAt5: own.length, blocked })
  }
  return out
}

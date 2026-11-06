import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import { runTool } from '@/lib/ai-producer-agent/tools/registry'
import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import type { ToolSchema } from '@/lib/ai-producer-agent/tools/schemas'
import { TOOL_SCHEMAS } from '@/lib/ai-producer-agent/tools/schemas'
import { summarizeToolResult } from '@/lib/ai-producer-agent/summarize'
import type { Budget } from '@/lib/ai-producer-agent/budget'
import { logAiProducerStep, redactArgs } from '@/lib/ai-producer-agent/log'
import { FILM_EDITING_THEORY, SPECIALIST_ROLES } from '@/lib/ai-producer-agent/film-theory'
import { JUST_CHATTING_EDITORIAL_DIRECTION, JUST_CHATTING_ROLE_DIRECTION, JUST_CHATTING_REVIEW_CHECKS } from '@/lib/ai-producer-agent/just-chatting-direction'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import { WORD_GUARD_MS, wordAtUnsafeBoundary } from '@/lib/ai-producer-agent/validate'

/** A creative brief, not a claim that the described outcome occurred.
 * The Finisher must independently verify that the intended payoff is spoken.
 */
export type EditorialOutline = {
  logline: string
  audiencePromise: string
  beats: string[]
  intendedPayoff: string
  essentialSetup: string
  excludeAsides: string[]
  endingRule: string
  highlightCriteria: string
}

export type EditorialRole = 'story' | 'footage' | 'dialogue' | 'qa'
export type EditorialSelection = {
  startMs: number
  endMs: number
  beat: string
  reason: string
}
/** Footage's own short first-pass edit inside a wider source candidate.
 * The Finisher is free to adjust, split or omit it; never a mandatory cut. */
export type FootagePreferredEdit = {
  candidateStartMs: number
  candidateEndMs: number
  preferredStartMs: number
  preferredEndMs: number
  intendedPoint: string
  endingCue: string
}
/** Keep useful per-passage guidance even if the source validator drops or
 * repairs a candidate. Hints never expand the allowed footage windows. */
export function validateFootagePreferredEdits(
  raw: unknown, selections: EditorialSelection[],
  bounds: [number, number],
): FootagePreferredEdit[] {
  if (!Array.isArray(raw)) return []
  const retained: FootagePreferredEdit[] = []
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue
    const r = value as Partial<FootagePreferredEdit>
    const { candidateStartMs, candidateEndMs, preferredStartMs, preferredEndMs, intendedPoint, endingCue } = r
    if (typeof candidateStartMs !== 'number' || typeof candidateEndMs !== 'number' ||
      typeof preferredStartMs !== 'number' || typeof preferredEndMs !== 'number' ||
      ![candidateStartMs,candidateEndMs,preferredStartMs,preferredEndMs].every(Number.isInteger) ||
      candidateStartMs < bounds[0] || candidateEndMs > bounds[1] ||
      candidateEndMs <= candidateStartMs ||
      preferredStartMs < candidateStartMs || preferredEndMs > candidateEndMs ||
      preferredEndMs <= preferredStartMs ||
      typeof intendedPoint !== 'string' || !intendedPoint.trim() ||
      typeof endingCue !== 'string' || !endingCue.trim()) continue
    // Each hint must correspond to a CURRENT accepted candidate, not an
    // index from the pre-repair submission. Clip the preferred range to
    // that candidate; ignore entries that cannot be safely paired.
    const source = selections.find(sel =>
      candidateStartMs <= sel.endMs && candidateEndMs >= sel.startMs &&
      preferredStartMs >= sel.startMs && preferredEndMs <= sel.endMs)
    if (!source || retained.some(p => p.candidateStartMs === source.startMs &&
      p.candidateEndMs === source.endMs)) continue
    retained.push({
      candidateStartMs: source.startMs, candidateEndMs: source.endMs,
      preferredStartMs, preferredEndMs,
      intendedPoint: intendedPoint.slice(0,220), endingCue: endingCue.slice(0,220),
    })
  }
  return retained
}
export type EditorialHandoff = {
  outline: EditorialOutline
  footage: EditorialSelection[]
  cutPlan: EditorialSelection[]
  preferredEdits?: FootagePreferredEdit[]
  finisher?: {
    payoff: { startMs: number; endMs: number; quote: string }
    editorialReason: string
    originalDurationSeconds: number
    finalDurationSeconds: number
  }
  highlightsFinisher?: {
    moments: Array<{
      selection: EditorialSelection
      landing: { startMs: number; endMs: number; quote: string }
      editorialReason: string
    }>
    originalDurationSeconds: number
    finalDurationSeconds: number
  }
  review?: { pass: boolean; issues: string[] }
}

const names: Record<EditorialRole, string> = {
  story: 'submit_story_outline',
  footage: 'submit_footage_selections',
  dialogue: 'submit_dialogue_cut_plan',
  qa: 'submit_editorial_review',
}
const readTools: Record<EditorialRole, string[]> = {
  story: ['get_transcript'],
  footage: ['get_transcript', 'analyze_visual'],
  dialogue: ['get_transcript', 'get_audio_energy'],
  qa: ['get_transcript', 'get_audio_energy'],
}
const jsonString = { type: 'string' }
const selection = {
  type: 'object', additionalProperties: false,
  properties: {
    startMs: { type: 'integer', minimum: 0 },
    endMs: { type: 'integer', minimum: 0 },
    beat: jsonString, reason: jsonString,
  },
  required: ['startMs', 'endMs', 'beat', 'reason'],
}
const submitSchemas: Record<EditorialRole, ToolSchema> = {
  story: {
    name: names.story, description: 'Submit a coherent paper-edit story outline.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        logline: jsonString,
        audiencePromise: jsonString,
        beats: { type: 'array', minItems: 3, maxItems: 10, items: jsonString },
        intendedPayoff: jsonString,
        essentialSetup: jsonString,
        excludeAsides: { type: 'array', maxItems: 10, items: jsonString },
        endingRule: jsonString,
        highlightCriteria: jsonString,
      },
      required: ['logline', 'audiencePromise', 'beats',
        'intendedPayoff', 'essentialSetup', 'excludeAsides', 'endingRule', 'highlightCriteria'],
    },
  },
  footage: {
    name: names.footage,
    description: 'Submit grounded candidate source intervals AND short preferred cuts with semantic ending cues.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { selections: { type: 'array', minItems: 2, maxItems: 24, items: selection } },
      required: ['selections'],
    },
  },
  dialogue: {
    name: names.dialogue,
    description: 'Submit final whole-thought boundaries preserving the story beats and requested output length, inside curated intervals.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { selections: { type: 'array', minItems: 2, maxItems: 24, items: selection } },
      required: ['selections'],
    },
  },
  qa: {
    name: names.qa, description: 'Report pass/fail and evidence-grounded editorial concerns.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        pass: { type: 'boolean' },
        issues: { type: 'array', maxItems: 15, items: jsonString },
      },
      required: ['pass', 'issues'],
    },
  },
}

function safeJson(input: string): Record<string, unknown> | null {
  try {
    const raw = JSON.parse(input) as unknown
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
  } catch {
    return null
  }
}

function validSelections(
  raw: unknown,
  bounds: [number, number],
  words: ClipWord[],
  allowed?: EditorialSelection[],
  minDurationMs = 3000,
): EditorialSelection[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) throw new Error('specialist_invalid_selection_count')
  const normalized: EditorialSelection[] = raw.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('specialist_invalid_selection')
    const r = entry as Record<string, unknown>
    const { startMs, endMs, beat, reason } = r
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) ||
      typeof startMs !== 'number' || typeof endMs !== 'number' ||
      startMs < bounds[0] || endMs > bounds[1] || endMs - startMs < minDurationMs ||
      typeof beat !== 'string' || typeof reason !== 'string' ||
      !reason.trim()) throw new Error('specialist_invalid_source_range')
    // Require transcript evidence for the proposed actual source.
    const matches = words.filter((w) => w.e * 1000 > startMs && w.s * 1000 < endMs)
    if (matches.length < (minDurationMs < 3000 ? 1 : 5)) throw new Error('specialist_range_has_no_speech_evidence')
    if (allowed && !allowed.some((a) => startMs >= a.startMs && endMs <= a.endMs)) {
      throw new Error('specialist_cut_outside_curated_footage')
    }
    // No cut through a retained word (30ms safety margin).
    for (const edge of [startMs, endMs]) {
      if (wordAtUnsafeBoundary(edge, words)) {
        throw new Error('specialist_cut_inside_word')
      }
    }
    return { startMs, endMs, beat: beat.slice(0, 90), reason: reason.slice(0, 320) }
  })
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i]!.startMs < normalized[i - 1]!.endMs) {
      throw new Error('specialist_non_chronological_cut')
    }
  }
  return normalized
}

/**
 * Locate a boundary that is not inside ANY transcript word. ASR timestamps
 * can overlap, so the first intersecting word is not necessarily enough.
 * Prefer a >=60ms real gap, but allow exact boundaries when speech is dense.
 * Limit edits to 1500ms; never silently move a selection several seconds.
 */
function nearestLegalEdge(
  edge: number, kind: 'startMs' | 'endMs',
  words: ClipWord[], bounds: [number, number],
  allowedRange?: [number, number],
  maxShiftMs = 1500,
): number | null {
  const lo = Math.max(bounds[0], allowedRange?.[0] ?? bounds[0])
  const hi = Math.min(bounds[1], allowedRange?.[1] ?? bounds[1])
  if (edge < lo || edge > hi) return null
  const spans = words
    .filter((w) => Number.isFinite(w.s) && Number.isFinite(w.e) && w.e > w.s)
    .map((w) => [Math.round(w.s * 1000) - WORD_GUARD_MS, Math.round(w.e * 1000) + WORD_GUARD_MS] as const)
    .sort((a, b) => a[0] - b[0])
  // Build merged speaking intervals once; overlapping ASR words must not
  // trick the repair into moving to another word's interior.
  const merged: Array<[number, number]> = []
  for (const [start, end] of spans) {
    const prev = merged[merged.length - 1]
    if (prev && start <= prev[1]) prev[1] = Math.max(prev[1], end)
    else merged.push([start, end])
  }
  const candidates = new Set<number>([edge, lo, hi])
  for (const [start, end] of merged) {
    if (Math.abs(start - edge) <= maxShiftMs) candidates.add(Math.max(lo, start))
    if (Math.abs(end - edge) <= maxShiftMs) candidates.add(Math.min(hi, end))
  }
  const legal = [...candidates].filter((c) =>
    c >= lo && c <= hi && Math.abs(c - edge) <= maxShiftMs &&
    !wordAtUnsafeBoundary(c, words))
  // Ties favor keeping the beginning of a phrase and the end of a phrase.
  legal.sort((a, b) => Math.abs(a - edge) - Math.abs(b - edge) ||
    (kind === 'startMs' ? a - b : b - a))
  return legal[0] ?? null
}

export function snapEditorialSelections(
  raw: unknown,
  bounds: [number, number],
  words: ClipWord[],
  allowed?: EditorialSelection[],
  minDurationMs = 3000,
): EditorialSelection[] {
  try { return validSelections(raw, bounds, words, allowed, minDurationMs) } catch (error) {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) throw error
    const repaired = raw.map((value) => {
      if (!value || typeof value !== 'object') return value
      const item = value as EditorialSelection
      if (!Number.isInteger(item.startMs) || !Number.isInteger(item.endMs) ||
          item.startMs < bounds[0] || item.endMs > bounds[1]) return value
      const curated = allowed?.find((a) =>
        item.startMs >= a.startMs && item.endMs <= a.endMs)
      // Never repair a dialogue cut outside its curated source selection.
      if (allowed && !curated) return value
      const range = curated ? [curated.startMs, curated.endMs] as [number, number] : undefined
      const startMs = nearestLegalEdge(item.startMs, 'startMs', words, bounds, range)
      const endMs = nearestLegalEdge(item.endMs, 'endMs', words, bounds, range)
      return {
        ...item,
        startMs: startMs ?? item.startMs,
        endMs: endMs ?? item.endMs,
      }
    })
    return validSelections(repaired, bounds, words, allowed, minDurationMs)
  }
}

/**
 * Recovery path for noisy ASR: never send the model through seven retries for
 * a single unsnappable word boundary. Respect source/curation/chronology and
 * retain useful intervals even if no nearby word-safe gap exists. Such edges
 * are explicitly flagged by draft validation for the editor to review.
 */
export function recoverEditorialSelections(
  raw: unknown, bounds: [number, number], words: ClipWord[],
  allowed?: EditorialSelection[],
): { selections: EditorialSelection[]; dropped: number; unsafeEdges: number } {
  const entries = Array.isArray(raw) ? raw.slice(0, 24) : []
  const candidates: EditorialSelection[] = []
  let dropped = 0
  for (const v of entries) {
    if (!v || typeof v !== 'object') { dropped++; continue }
    const r = v as Partial<EditorialSelection>
    if (!Number.isInteger(r.startMs) || !Number.isInteger(r.endMs) ||
        typeof r.startMs !== 'number' || typeof r.endMs !== 'number' ||
        r.startMs < bounds[0] || r.endMs > bounds[1] || r.endMs <= r.startMs ||
        typeof r.beat !== 'string' || typeof r.reason !== 'string' || !r.reason.trim()) {
      dropped++
      continue
    }
    const curated = allowed?.find((a) => r.startMs! >= a.startMs && r.endMs! <= a.endMs)
    if (allowed && !curated) { dropped++; continue }
    const range = curated ? [curated.startMs, curated.endMs] as [number, number] : undefined
    // Prefer genuine legal edges, searching farther than normal precision snapping.
    // A null result means retain the proposed edge, not discard the entire run.
    const snappedStart = nearestLegalEdge(r.startMs, 'startMs', words, bounds, range, 30_000)
    const snappedEnd = nearestLegalEdge(r.endMs, 'endMs', words, bounds, range, 30_000)
    // Do not let a remote legal edge collapse a useful interval. Try the
    // smallest safe adjustment first, then preserve original editorial bounds.
    let startMs = snappedStart ?? r.startMs
    let endMs = snappedEnd ?? r.endMs
    // Long-range safety snapping must not silently erase an entire story beat.
    // In dense ASR preserve the sourced candidate and flag its word edge.
    if (endMs - startMs < Math.max(3000, (r.endMs - r.startMs) * 0.8)) {
      startMs = r.startMs
      endMs = r.endMs
    }
    if (endMs - startMs < 3000) {
      startMs = r.startMs
      endMs = r.endMs
    }
    if (endMs - startMs < 3000 ||
        words.filter((w) => w.e * 1000 > startMs && w.s * 1000 < endMs).length < 5) {
      dropped++
      continue
    }
    candidates.push({ startMs, endMs, beat: r.beat.slice(0, 90), reason: r.reason.slice(0, 320) })
  }
  // Preserve chronology while dropping overlapping or invalid proposals.
  candidates.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const selections: EditorialSelection[] = []
  for (const item of candidates) {
    if (selections.length && item.startMs < selections[selections.length - 1]!.endMs) {
      dropped++
      continue
    }
    selections.push(item)
  }
  return { selections, dropped,
    unsafeEdges: selections.reduce((n, item) => n +
      Number(Boolean(wordAtUnsafeBoundary(item.startMs, words))) +
      Number(Boolean(wordAtUnsafeBoundary(item.endMs, words))), 0) }
}

/** Source-gap diversity is measured in the original recording, not in export seconds.
 * Breaths and filler cuts do not count as separate highlights. No arbitrary
 * number of jumps is imposed when the recording has fewer usable moments.
 */
export function highlightsCoverage(
  selections: EditorialSelection[], target: [number, number],
) {
  const durationSeconds = selections.reduce((n, s) => n + (s.endMs - s.startMs), 0) / 1000
  const distinctMomentCount = selections.length
    ? 1 + selections.slice(1).filter((s, i) => s.startMs - selections[i]!.endMs >= 8_000).length
    : 0
  const minimumDistinct = target[1] <= 45 ? 2 : 3
  return {
    durationSeconds, distinctMomentCount, minimumDistinct,
    needsRevision: durationSeconds < target[0] || distinctMomentCount < minimumDistinct,
  }
}

function selectionDurationS(selections: EditorialSelection[]): number {
  return selections.reduce((sum, s) => sum + (s.endMs - s.startMs), 0) / 1000
}

/**
 * Editorial diagnostics, not an arbitrary requirement for long jumps.
 * Contiguous material can be the right story, but when a 20-minute source
 * produces an unfinished minute-long excerpt we must search alternatives.
 */
export function shortStoryCoverage(
  selections: EditorialSelection[], words: ClipWord[], target: [number, number],
  sourceRange: [number, number],
) {
  const durationSeconds = selectionDurationS(selections)
  const sourceSpanMs = selections.length
    ? selections[selections.length - 1]!.endMs - selections[0]!.startMs : 0
  const longestSourceGapMs = selections.reduce((largest, seg, i) =>
    i ? Math.max(largest, seg.startMs - selections[i - 1]!.endMs) : largest, 0)
  const ending = selections[selections.length - 1]
  const tailWords = ending
    ? words.filter(w => w.e * 1000 > ending.startMs && w.s * 1000 < ending.endMs)
      .sort((a, b) => a.s - b.s).slice(-8) : []
  const lastWord = tailWords[tailWords.length - 1]?.w?.trim() ?? ''
  const terminalSentence = /[.!?][\"'”’]?$/.test(lastWord) && !/\.{2,}[\"'”’]?$/.test(lastWord)
  // Some ASR providers omit ALL punctuation. In that case absence of a
  // period is not proof of a broken ending. An ellipsis or dangling function
  // word is still actionable evidence of an unfinished thought.
  const punctuationAvailable = words.some((w) => /[.!?]$/.test(w.w.trim()))
  const explicitDangling = /\.{2,}$/.test(lastWord) ||
    /^(and|but|because|so|then|just|to|the|a|an|i|we|you|they|he|she|it|of|for|with|that|when|if)$/i.test(lastWord.replace(/[,.!?]+$/, ''))
  const endingNeedsReview = !terminalSentence && (punctuationAvailable || explicitDangling)
  const enoughSourceToExplore = sourceRange[1] - sourceRange[0] >= 3 * 60_000
  const localOnly = enoughSourceToExplore &&
    sourceSpanMs <= Math.max(90_000, target[1] * 1000 * 1.2) &&
    longestSourceGapMs < 8_000
  return {
    durationSeconds, sourceSpanMs, longestSourceGapMs,
    lastWord, terminalSentence,
    localOnly,
    underTarget: durationSeconds < target[0],
    endingNeedsReview,
    needsReview: durationSeconds < target[0] || endingNeedsReview || localOnly,
  }
}

/** Duration targets guide editing quality but must not block a usable cut. */
function durationAdvisory(selections: EditorialSelection[], target: [number, number]) {
  const actualSeconds = selectionDurationS(selections)
  const [minimumSeconds, maximumSeconds] = target
  return {
    actualSeconds, minimumSeconds, maximumSeconds,
    outsideTarget: actualSeconds < minimumSeconds || actualSeconds > maximumSeconds,
  }
}

function selectionRepairHint(
  raw: unknown, words: ClipWord[], bounds: [number, number],
  allowed?: EditorialSelection[],
): Record<string, unknown> {
  if (!Array.isArray(raw)) return { instruction: 'Submit 2–24 intervals.' }
  const entries: Record<string, unknown>[] = []
  for (let i = 0; i < Math.min(raw.length, 24); i++) {
    const r = raw[i] as EditorialSelection | null
    if (!r || !Number.isInteger(r.startMs) || !Number.isInteger(r.endMs)) {
      entries.push({ index: i, problem: 'non_integer_boundary' })
      continue
    }
    const inCurated = allowed?.find((a) => r.startMs >= a.startMs && r.endMs <= a.endMs)
    if (allowed && !inCurated) entries.push({ index: i, problem: 'outside_curated_footage' })
    const range = inCurated ? [inCurated.startMs, inCurated.endMs] as [number, number] : undefined
    const suggestedStartMs = nearestLegalEdge(r.startMs, 'startMs', words, bounds, range)
    const suggestedEndMs = nearestLegalEdge(r.endMs, 'endMs', words, bounds, range)
    if (suggestedStartMs !== r.startMs || suggestedEndMs !== r.endMs) {
      entries.push({ index: i, proposed: [r.startMs, r.endMs],
        suggested: [suggestedStartMs, suggestedEndMs] })
    }
    if (r.startMs < bounds[0] || r.endMs > bounds[1] || r.endMs - r.startMs < 3000) {
      entries.push({ index: i, problem: 'invalid_source_range_or_duration' })
    }
    if (i > 0 && (raw[i - 1] as EditorialSelection)?.endMs > r.startMs) {
      entries.push({ index: i, problem: 'non_chronological_overlap' })
    }
  }
  return { entries: entries.slice(0, 24),
    instruction: 'Check all intervals: 3+ seconds, chronological, transcript speech and source bounds. Use suggested safe edges.' }
}

/** Safe structured diagnostics; never log raw transcripts, prompts, media URLs or secrets. */
function selectionLogSummary(args: Record<string, unknown> | null): string {
  const selections = args?.selections
  if (!Array.isArray(selections)) return JSON.stringify({ keys: Object.keys(args ?? {}) })
  return JSON.stringify({ count: selections.length, intervals: selections.slice(0, 24).map((r) => {
    if (!r || typeof r !== 'object') return { invalid: true }
    const item = r as Record<string, unknown>
    return { startMs: item.startMs, endMs: item.endMs }
  }) })
}

/** Structured console + persisted DB entries share the same event payload. */
async function specialistEvent(
  ctx: ToolCtx, budget: Budget, role: EditorialRole, event: string,
  diagnostic: Record<string, unknown>, error?: string,
) {
  const payload = { runId: ctx.runId, role, event, ...diagnostic }
  console.info('[ai-producer:specialist]', JSON.stringify(payload))
  await logAiProducerStep({
    runId: ctx.runId, stepIndex: budget.steps,
    phase: 'plan', tool: `specialist_${role}_${event}`, kind: 'validate',
    argsSummary: JSON.stringify(diagnostic).slice(0, 4000),
    resultSummary: event,
    error,
  })
}

export function checkEditorialSelections(
  selections: unknown,
  bounds: [number, number],
  words: ClipWord[],
  allowed?: EditorialSelection[],
  minDurationMs = 3000,
): EditorialSelection[] {
  return validSelections(selections, bounds, words, allowed, minDurationMs)
}

/** Prevent one stage from mutating the timeline or accessing other agents' tools. */
export async function runEditorialRole(
  ctx: ToolCtx,
  out: OutputState,
  budget: Budget,
  role: EditorialRole,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const source = ctx.sources[0]
  if (!source?.rangeMs) throw new Error('specialist_source_window_missing')
  const highlightsMode = ctx.config.roughCutIntent === 'highlights'
  const allowedTools = TOOL_SCHEMAS.filter((tool) => readTools[role].includes(tool.name))
  const tools = [...allowedTools, submitSchemas[role]]
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      FILM_EDITING_THEORY, SPECIALIST_ROLES[role],
      ...(ctx.config.editMode === 'just_chatting_rough_cut'
        ? [JUST_CHATTING_EDITORIAL_DIRECTION, JUST_CHATTING_ROLE_DIRECTION[role],
          ctx.config.targetLengthS[1] <= 105
            ? 'SHORT HIGHLIGHT OVERRIDE: Produce one concise 30–90 second standalone edit from the strongest sourced exchange. Prioritize an immediate understandable hook, essential context, and a satisfying payoff. Remove digressions and repetition. Short-form compression is intentional; do NOT follow the long-form pacing guidance. Respect meaning, chronology, and honest reactions. Target seconds supplied in the request.'
            : 'LONG CONVERSATION EDIT: Preserve natural context and pacing with complete thoughts. The target duration is advisory, not a failure gate.',
        ] : []),
      ...(highlightsMode ? [
        'HIGHLIGHTS MODE OVERRIDE: Curate several DISTINCT memorable moments across the WHOLE available source, not one continuous scene with breath cuts. Each moment must be independently understandable and interesting; authentic jokes, surprising answers, revealing quotes, reactions or sharp insights are welcome. Select 2 distinct moments for very short highlights and ideally 3+ for 60–120 seconds, without forcing weak filler. Do not pretend unrelated moments form one chronological story. Avoid repetitive quotes, fabricated context, misleading juxtapositions, dangling sentences, or cuts inside words. Source-order chronological output is required.'
      ] : []),
      'Tools are restricted by your role. Do not invent tool results. Submit one structured response with your submit tool.',
      'Work in original absolute source milliseconds. Do not flatten or export.',
    ].join('\n\n') },
    { role: 'user', content: JSON.stringify({
      ...context, sourceId: source.sourceId, sourceRangeMs: source.rangeMs,
      outputTargetSeconds: ctx.config.targetLengthS,
      editingIntent: highlightsMode ? 'multi_moment_highlights' : ctx.config.targetLengthS[1] <= 105 ? 'short_story' : 'conversational_long_form',
      ...(role === 'footage' && !highlightsMode &&
        ctx.config.editMode === 'just_chatting_rough_cut' && ctx.config.targetLengthS[1] <= 105
        ? { preferredEditInstruction: 'SHORT STORY: selections ARE THE FINAL PAPER EDIT, not a source inventory. Return only the concise chronological excerpts you intend to appear in the finished video, roughly the requested 90 seconds. Do not return a separate preferredEdits array. A later boundary-polish pass only removes stray edge words and will NOT choose the story again.' } : {}),
      ...((role === 'footage' || role === 'dialogue')
        ? { selectionDurationInstruction: highlightsMode
          ? 'Find distinct self-contained highlights from different source moments. Do not count adjacent breath cuts as different moments. Choose compelling footage up to the duration target without padding; finish each excerpt on a complete thought.'
          : 'For short Story, selections are the ACTUAL EDIT roughly within the target seconds, not hundreds of seconds of candidate footage. Cut whole irrelevant phrases and tangents; keep the setup, development and payoff. Do not pad or cut mid-thought. If truly insufficient material exists, submit the most coherent short edit.' }
        : {}),
      ...(role === 'qa' && ctx.config.editMode === 'just_chatting_rough_cut'
        ? { requiredReviewChecks: JUST_CHATTING_REVIEW_CHECKS } : {}),
    }) },
  ]
  let transcriptReads = 0
  let invalidSubmissions = 0
  await specialistEvent(ctx, budget, role, 'start', {
    wordCount: ctx.cache.words?.length ?? 0, sourceRangeMs: source.rangeMs,
    allowedCount: Array.isArray(context.curatedSelections) ? context.curatedSelections.length : undefined,
  })
  for (let turn = 0; turn < 10; turn++) {
    if (budget.state() === 'hard') throw new Error('specialist_budget_exhausted')
    // Reserve the last half of the budget for a structured handoff, not
    // repeated transcript searches. The initial context already includes
    // inventory plus twelve chronological transcript samples.
    const mustSubmit = turn >= 5 || transcriptReads >= 3 || invalidSubmissions >= 2
    const turnTools = mustSubmit ? [submitSchemas[role]] : tools
    await specialistEvent(ctx, budget, role, 'turn', { turn, transcriptReads, invalidSubmissions, forcedSubmit: mustSubmit, allowedTools: turnTools.map((t) => t.name) })
    const response = await lunaChat({ messages, tools: turnTools, toolChoice: 'required' })
    budget.steps++
    budget.addLuna(response.usage)
    messages.push(response.message)
    await logAiProducerStep({
      runId: ctx.runId, stepIndex: budget.steps,
      phase: 'plan', tool: 'specialist_' + role, kind: 'luna',
      resultSummary: `${response.message.tool_calls?.length ?? 0} specialist tool calls`,
      tokensIn: response.usage?.prompt_tokens,
      tokensOut: response.usage?.completion_tokens,
    })
    const calls = response.message.tool_calls ?? []
    if (!calls.length) {
      messages.push({ role: 'user', content: `Call ${names[role]} when ready, or an available read-only tool.` })
      continue
    }
    for (const call of calls) {
      const name = call.function.name
      const args = safeJson(call.function.arguments)
      if (name === names[role]) await specialistEvent(ctx, budget, role, 'submit_attempt', {
        turn, callId: call.id, proposal: selectionLogSummary(args),
        malformedJson: args === null,
      })
      if (name === names[role] && !args) {
        invalidSubmissions++
        await specialistEvent(ctx, budget, role, 'rejected', {
          turn, invalidSubmissions, errorCode: 'specialist_malformed_submission',
        }, 'specialist_malformed_submission')
        if (invalidSubmissions >= 2) throw new Error(`specialist_${role}_unusable_submissions`)
        messages.push({ role: 'tool', tool_call_id: call.id,
          content: '{"ok":false,"error":"specialist_malformed_submission","instruction":"Submit valid structured JSON."}' })
        continue
      }
      if (name === names[role] && args) {
        try {
        if (role === 'story') {
          if (typeof args.logline !== 'string' || typeof args.audiencePromise !== 'string' ||
              !Array.isArray(args.beats) || args.beats.length < 3 ||
              args.beats.length > 10 || !args.beats.every((b) => typeof b === 'string') ||
              !['intendedPayoff','essentialSetup','endingRule','highlightCriteria']
                .every(k => typeof args[k] === 'string' && (args[k] as string).trim().length > 0) ||
              !Array.isArray(args.excludeAsides) || args.excludeAsides.length > 10 ||
              !args.excludeAsides.every((v) => typeof v === 'string')) {
            throw new Error('specialist_story_outline_invalid')
          }
          await specialistEvent(ctx, budget, role, 'accepted', { turn, beatCount: args.beats.length })
          return args
        }
        if (role === 'footage' || role === 'dialogue') {
          const allowed = role === 'dialogue'
            ? context.curatedSelections as EditorialSelection[] | undefined
            : undefined
          let selections: EditorialSelection[]
          let recovery: ReturnType<typeof recoverEditorialSelections> | undefined
          try {
            selections = snapEditorialSelections(args.selections, source.rangeMs, ctx.cache.words ?? [], allowed)
          } catch (firstError) {
            recovery = recoverEditorialSelections(args.selections, source.rangeMs, ctx.cache.words ?? [], allowed)
            if (!recovery.selections.length) throw firstError
            selections = recovery.selections
            await specialistEvent(ctx, budget, role, 'server_recovered', {
              turn, dropped: recovery.dropped, unsafeEdges: recovery.unsafeEdges,
              count: selections.length, originalError: String((firstError as Error).message),
            })
          }
          const duration = durationAdvisory(selections, ctx.config.targetLengthS)
          await specialistEvent(ctx, budget, role, 'duration_advisory', { ...duration, acceptedDespiteDuration: duration.outsideTarget })
          await specialistEvent(ctx, budget, role, 'accepted', { turn, proposal: selectionLogSummary(args),
            accepted: selections.map((s) => [s.startMs, s.endMs]),
            movedEdges: selections.filter((s, i) => s.startMs !== (args.selections as EditorialSelection[])[i]?.startMs ||
              s.endMs !== (args.selections as EditorialSelection[])[i]?.endMs).length,
          })
          return { selections }
        }
        if (typeof args.pass !== 'boolean' || !Array.isArray(args.issues) ||
            !args.issues.every((i) => typeof i === 'string')) {
          throw new Error('specialist_review_invalid')
        }
        await specialistEvent(ctx, budget, role, 'accepted', { turn, pass: args.pass, issueCount: args.issues.length })
        return { pass: args.pass, issues: args.issues.slice(0, 15) }
        } catch (error) {
          invalidSubmissions++
          const errorCode = String((error as Error)?.message ?? error).slice(0, 240)
          const allowed = role === 'dialogue'
            ? context.curatedSelections as EditorialSelection[] | undefined
            : undefined
          const repairHint = (role === 'footage' || role === 'dialogue')
            ? selectionRepairHint(args.selections, ctx.cache.words ?? [], source.rangeMs, allowed)
            : {}
          await specialistEvent(ctx, budget, role, 'rejected', {
            turn, invalidSubmissions, errorCode,
            proposal: selectionLogSummary(args),
            repairHint,
          }, errorCode)
          // Models sometimes choose an imprecise word boundary. Reject the
          // proposal but give this specialist a chance to repair it before
          // the entire twenty-minute run fails.
          if (invalidSubmissions >= 2) {
            // Returning control to the orchestrator activates the source-grounded
            // fallback; do not spend seven turns guessing the same impossible edge.
            throw new Error(`specialist_${role}_unusable_submissions`)
          }
          messages.push({
            role: 'tool', tool_call_id: call.id,
            content: JSON.stringify({
              ok: false,
              error: errorCode,
              repairHint,
              instruction: 'Correct and resubmit using sourced chronological intervals.',
            }),
          })
          continue
        }
      }
      // Enforce read-only tools even if the model hallucinates a tool name.
      if (!readTools[role].includes(name)) {
        await specialistEvent(ctx, budget, role, 'forbidden_tool', { turn, name })
        messages.push({ role: 'tool', tool_call_id: call.id, content: '{"ok":false,"error":"role_tool_forbidden"}' })
        continue
      }
      if (name === 'get_transcript') transcriptReads++
      const result = await runTool(ctx, name, args ?? {}, out, budget)
      budget.steps++
      budget.addGemini(result.costUsd)
      await logAiProducerStep({
        runId: ctx.runId, stepIndex: budget.steps,
        phase: 'plan', tool: `specialist_${role}_${name}`, kind: 'tool',
        argsSummary: JSON.stringify(redactArgs(args)).slice(0, 1200),
        resultSummary: result.summary, estUsd: result.costUsd,
        error: result.ok ? undefined : result.summary,
      })
      messages.push({ role: 'tool', tool_call_id: call.id, content: summarizeToolResult(name, result) })
    }
  }
  await specialistEvent(ctx, budget, role, 'exhausted', { transcriptReads, invalidSubmissions },
    `specialist_${role}_did_not_submit`)
  throw new Error(`specialist_${role}_did_not_submit_after_${invalidSubmissions}_invalid_attempts`)
}

function representativeTranscript(words: ClipWord[], range: [number, number]) {
  // Chronological coverage, not only top highlights. Each excerpt points to
  // words that exist; the specialist can request fuller nearby transcripts.
  const windows = 12
  const span = (range[1] - range[0]) / windows
  return Array.from({ length: windows }, (_, i) => {
    const start = range[0] + i * span
    const end = start + span
    const hits = words.filter((w) => w.s * 1000 < end && w.e * 1000 > start)
    return {
      rangeMs: [Math.round(start), Math.round(end)],
      excerpt: hits.slice(0, 25).map((w) => w.w).join(' ').slice(0, 300),
      endingExcerpt: hits.slice(-25).map((w) => w.w).join(' ').slice(0, 300),
    }
  })
}

export async function createEditorialHandoff(
  ctx: ToolCtx, out: OutputState, budget: Budget, instruction: string | null,
): Promise<EditorialHandoff> {
  const source = ctx.sources[0]
  if (!source?.rangeMs || !ctx.cache.words?.length) throw new Error('rough_cut_transcript_missing')
  const highlightsMode = ctx.config.roughCutIntent === 'highlights'
  const base = {
    instruction,
    transcriptSamples: representativeTranscript(ctx.cache.words, source.rangeMs),
    observedMoments: ctx.cache.momentsSummary,
    inventory: ctx.cache.inventorySummary,
    audienceGoal: highlightsMode
      ? 'A highlight reel of multiple distinct, entertaining, independently comprehensible moments across the whole source, with honest context and complete thoughts'
      : ctx.config.targetLengthS[1] <= 105
        ? 'A standalone short-form story with an understandable setup, development and payoff, targeting the requested duration'
        : 'A coherent conversational long-form edit preserving context and natural pacing',
    editingPriorities: ['meaning and context','narrative payoff','natural dialogue and reactions','no repetition','restrained polish'],
  }
  let story: Record<string, unknown>
  try {
    story = await runEditorialRole(ctx, out, budget, 'story', {
      ...base,
      instruction: highlightsMode
        ? 'Define the editorial criteria for selecting independent, self-contained highlights. The payoff and ending fields express what makes a moment satisfying, not a fabricated shared narrative. Provide all structured creative-brief fields.'
        : 'Define the main story, intended resolution (as a hypothesis to VERIFY in the source), essential setup, off-topic material to exclude, and exact editorial condition for a natural ending. Provide all structured creative-brief fields. Do not assert an unconfirmed outcome as fact.',
    })
  } catch (error) {
    // An unavailable paper outline must not destroy a sourced editable draft.
    await specialistEvent(ctx, budget, 'story', 'fallback', {
      errorCode: String((error as Error)?.message ?? error).slice(0, 200),
    })
    story = { logline: 'Source-grounded conversational rough cut',
      audiencePromise: 'Review the best available recorded conversation',
      beats: ['context', 'discussion', 'resolution'],
      intendedPayoff: 'Determine the actual recorded resolution; do not assume the outcome',
      essentialSetup: 'Include enough recorded context to understand what happened',
      excludeAsides: [],
      endingRule: 'Stop once the genuine, source-supported idea resolves naturally',
      highlightCriteria: 'Select individually interesting exchanges with their own complete landing' }
  }
  const outline: EditorialOutline = {
    logline: String(story.logline),
    audiencePromise: String(story.audiencePromise),
    beats: (story.beats as string[]).slice(0, 10),
    intendedPayoff: String(story.intendedPayoff),
    essentialSetup: String(story.essentialSetup),
    excludeAsides: (story.excludeAsides as string[]).slice(0, 10),
    endingRule: String(story.endingRule),
    highlightCriteria: String(story.highlightCriteria),
  }
  let found: Record<string, unknown>
  try {
    found = await runEditorialRole(ctx, out, budget, 'footage', {
      ...base, storyOutline: outline,
      instruction: highlightsMode
        ? 'HIGHLIGHTS SCOUT: Compare the strongest memorable moments from across the full authorized recording. Select 2+ distinct moments for short edits and ideally 3+ for one to two minutes. Moments must offer new entertainment/information, not simply adjacent speech separated by a pause. Each moment needs just enough setup and its own landing; order chronologically, preserve meaning, and avoid unrelated filler. Do not take a continuous 90-second stretch as a highlights reel.'
        : ctx.config.targetLengthS[1] <= 105
        ? 'SHORT FILM PAPER EDIT: YOU OWN THE FINAL SELECTION. Analyze relevant moments across the recording, then return ONLY about 75–105 seconds of the strongest source-grounded spoken material in selections. This is the edit, NOT an inventory of relevant footage. Choose setup, development and real payoff; omit all tangents, repetition and extra context. Keep chronological source order and complete natural thoughts. A following boundary agent can only remove up to 3 seconds from each edge; it cannot compress your edit for you.'
        : 'Select coherent source intervals; evidence first, then editorial value.',
    })
  } catch (error) {
    // Last-resort, honest first-pass source selection. Keep an editable draft
    // rather than losing the upload to failed model submissions.
    const [start, end] = source.rangeMs
    const targetMs = Math.min(end - start, Math.max(30_000, ctx.config.targetLengthS[0] * 1000))
    const fallbackStart = Math.max(start, end - targetMs)
    const provisional: EditorialSelection[] = [{
      startMs: fallbackStart, endMs: end, beat: 'discussion',
      reason: 'Fallback source selection; review and refine in the editor',
    }]
    const recovered = recoverEditorialSelections(provisional, source.rangeMs, ctx.cache.words)
    if (!recovered.selections.length) throw error
    await specialistEvent(ctx, budget, 'footage', 'fallback_to_source', {
      errorCode: String((error as Error)?.message ?? error).slice(0, 200),
      selectedMs: end - fallbackStart, unsafeEdges: recovered.unsafeEdges,
    })
    found = { selections: recovered.selections }
  }
  let footage = found.selections as EditorialSelection[]
  const [minimumSeconds, maximumSeconds] = ctx.config.targetLengthS
  const shortStory = !highlightsMode && ctx.config.editMode === 'just_chatting_rough_cut' && maximumSeconds <= 105
  // One targeted *editorial* retry instead of accepting a 20s excerpt as a
  // requested 90s story. Preserve original cuts if the revision is worse.
  const firstCoverage = shortStory
    ? shortStoryCoverage(footage, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
    : null
  const firstHighlightsCoverage = highlightsMode
    ? highlightsCoverage(footage, ctx.config.targetLengthS)
    : null
  if (firstHighlightsCoverage?.needsRevision && budget.state() !== 'hard') {
    const before = footage
    try {
      const revision = await runEditorialRole(ctx, out, budget, 'footage', {
        ...base, storyOutline: outline, previousSelections: before,
        previousCoverage: firstHighlightsCoverage,
        instruction: 'HIGHLIGHTS REVISION: The proposal uses adjacent segments like one excerpt, or is too short. Search DIFFERENT locations across the whole authorized source. Curate the strongest self-contained, non-repetitive moments with distinct source gaps (not breath cuts). Retain complete context and sentence endings for every highlight, and target the requested total length. Never pad with weak or unrelated footage.',
      })
      const candidates = revision.selections as EditorialSelection[]
      const after = highlightsCoverage(candidates, ctx.config.targetLengthS)
      const beforeScore = firstHighlightsCoverage.distinctMomentCount
      if (after.distinctMomentCount > beforeScore &&
          after.durationSeconds >= Math.min(firstHighlightsCoverage.durationSeconds * 0.65, minimumSeconds * 0.7) &&
          after.durationSeconds <= maximumSeconds * 1.5) {
        footage = candidates
        await specialistEvent(ctx, budget, 'footage', 'highlights_repaired', {
          before: firstHighlightsCoverage, after,
        })
      } else {
        await specialistEvent(ctx, budget, 'footage', 'highlights_revision_kept_original', { before: firstHighlightsCoverage, after })
      }
    } catch (error) {
      await specialistEvent(ctx, budget, 'footage', 'highlights_repair_unavailable', {
        errorCode: String((error as Error)?.message ?? error).slice(0, 200),
      })
    }
  }
  if (shortStory && (firstCoverage?.needsReview || selectionDurationS(footage) > maximumSeconds * 1.5) && budget.state() !== 'hard') {
    const beforeSeconds = selectionDurationS(footage)
    try {
      const revised = await runEditorialRole(ctx, out, budget, 'footage', {
        ...base, storyOutline: outline,
        previousSelections: footage,
        previousDurationSeconds: beforeSeconds,
        previousCoverage: firstCoverage,
        missingSecondsToMinimum: Math.max(0, Math.round(minimumSeconds - beforeSeconds)),
        instruction: 'FINAL STORY PAPER EDIT REVISION: selections must be the concise final edit near the requested duration, not a large source-gathering draft. Re-evaluate only essential setup, development and payoff and omit extras. Preserve chronology and honest context. If the first attempt was too long, cut whole unnecessary sentences now; if too short, add essential context without padding.',
      })
      const candidates = revised.selections as EditorialSelection[]
      const candidateSeconds = selectionDurationS(candidates)
      const candidateCoverage = shortStoryCoverage(candidates, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
      const originalWasOversized = beforeSeconds > maximumSeconds * 1.5
      const meaningfullyShorter = originalWasOversized && candidateSeconds < beforeSeconds * 0.9 &&
        candidateSeconds >= minimumSeconds * 0.7 && !candidateCoverage.localOnly
      // Do not replace a reasonable existing edit with a longer but weaker
      // single excerpt. A complete ending or meaningful broader coverage can
      // justify a shorter alternative; adding arbitrary seconds cannot.
      const improvesEnding = !firstCoverage.terminalSentence && candidateCoverage.terminalSentence
      const improvesCoverage = firstCoverage.localOnly && !candidateCoverage.localOnly
      const improvesDuration = candidateSeconds >= minimumSeconds &&
        beforeSeconds < minimumSeconds && !candidateCoverage.localOnly
      const notWorse = candidateSeconds >= Math.min(beforeSeconds * 0.75, minimumSeconds * 0.8)
      if (meaningfullyShorter || (notWorse && candidateSeconds <= maximumSeconds * 1.5 &&
          (improvesEnding || improvesCoverage || improvesDuration ||
           (candidateSeconds > beforeSeconds + 5 && !candidateCoverage.localOnly)))) {
        footage = candidates
        await specialistEvent(ctx, budget, 'footage', 'short_story_repaired', {
          beforeSeconds, afterSeconds: candidateSeconds, count: footage.length,
          beforeCoverage: firstCoverage, afterCoverage: candidateCoverage,
        })
      } else {
        await specialistEvent(ctx, budget, 'footage', 'short_story_revision_kept_original', {
          beforeSeconds, candidateSeconds,
          candidateCoverage,
        })
      }
    } catch (error) {
      await specialistEvent(ctx, budget, 'footage', 'short_story_repair_unavailable', {
        errorCode: String((error as Error)?.message ?? error).slice(0, 200),
      })
    }
  }
  // Footage owns the edit. When it returns a long source inventory, ask the
  // SAME specialist to submit a real short paper edit; do not ask Finisher to
  // re-edit hundreds of seconds, and never promote a longer draft on retry.
  if (shortStory && selectionDurationS(footage) > maximumSeconds + 3 && budget.state() !== 'hard') {
    for (let attempt = 0; attempt < 2 && budget.state() !== 'hard'; attempt++) {
      const beforeSeconds = selectionDurationS(footage)
      try {
        const sourceWords = ctx.cache.words ?? []
        const candidateExcerpts = footage.map(sel => ({
          selection: sel,
          words: sourceWords.filter(w => w.e * 1000 > sel.startMs && w.s * 1000 < sel.endMs)
            .map(w => [Math.round(w.s*1000),Math.round(w.e*1000),w.w]),
        }))
        const revised = await runEditorialRole(ctx, out, budget, 'footage', {
          ...base, storyOutline: outline,
          previousSelections: footage,
          selectedCandidateTranscript: candidateExcerpts,
          sourceWordTuple: '[startMs,endMs,word]',
          requestedSeconds: [minimumSeconds,maximumSeconds],
          instruction: 'COMPRESS TO FINAL STORY NOW. The previous footage proposal is an oversized candidate inventory (' +
            beforeSeconds.toFixed(1) + ' seconds). Return ONLY the actual source cuts that belong in the finished approximately 90-second story. Remove whole repetitive sentences, extra questions and unrelated tangents. Aim for 75–105 seconds of complete thoughts with setup, development, real payoff. No preferredEdits array. Do not hand the boundary polisher a long draft; it can only remove 3 seconds at each edge. Keep cuts source-grounded and chronological.',
        })
        const candidate = revised.selections as EditorialSelection[]
        const afterSeconds = selectionDurationS(candidate)
        // Prefer the shorter coherent source-grounded proposal, not a 700s
        // draft. Reject grossly undersized stubs, but do not require exactly 90.
        if (afterSeconds >= minimumSeconds * 0.65 &&
            afterSeconds < beforeSeconds - 2) {
          footage = candidate
          await specialistEvent(ctx, budget, 'footage', 'final_short_edit_accepted', {
            beforeSeconds, afterSeconds, attempt, count: candidate.length,
          })
        } else {
          await specialistEvent(ctx, budget, 'footage', 'final_short_edit_not_better', {
            beforeSeconds, afterSeconds, attempt,
          })
        }
      } catch (error) {
        await specialistEvent(ctx, budget, 'footage', 'final_short_edit_retry_failed', {
          attempt, errorCode: String((error as Error)?.message ?? error).slice(0,200),
        })
      }
      if (selectionDurationS(footage) <= maximumSeconds + 3) break
    }
  }
  // The Finisher no longer selects moments, compresses a 20-minute transcript,
  // invents a payoff or changes the story. It only polishes the exact existing
  // footage edges with nearby conversational context.
  let finisher: EditorialHandoff['finisher']
  const useFinisher = !highlightsMode &&
    ctx.config.editMode === 'just_chatting_rough_cut' &&
    maximumSeconds <= 135
  if (useFinisher && budget.state() !== 'hard' &&
      selectionDurationS(footage) <= maximumSeconds + 15) {
    try {
      const { runStoryBoundaryFinisher } = await import('@/lib/ai-producer-agent/story-finisher')
      const originalDurationSeconds = selectionDurationS(footage)
      const polished = await runStoryBoundaryFinisher(ctx, budget, outline, footage)
      footage = polished
      await specialistEvent(ctx, budget, 'story', 'boundary_polish_handoff', {
        beforeSeconds: originalDurationSeconds, afterSeconds: selectionDurationS(footage),
        count: footage.length,
      })
    } catch (error) {
      await specialistEvent(ctx, budget, 'story', 'boundary_polish_unavailable', {
        errorCode: String((error as Error)?.message ?? error).slice(0,200),
        note: 'Keep the Footage paper edit unchanged.',
      })
    }
  } else if (useFinisher) {
    await specialistEvent(ctx, budget, 'story', 'boundary_polish_skipped_oversized_footage', {
      sourceSeconds: selectionDurationS(footage),
      maximumSeconds,
      note: 'Boundary polish cannot substitute for the Footage Agent final edit.',
    })
  }
  let highlightsFinisher: EditorialHandoff['highlightsFinisher']
  if (highlightsMode && footage.length >= 2 && budget.state() !== 'hard') {
    try {
      const { runHighlightsFinisher } = await import('@/lib/ai-producer-agent/story-finisher')
      const originalDurationSeconds = selectionDurationS(footage)
      const decision = await runHighlightsFinisher(ctx, budget, outline, footage)
      footage = decision.selections
      highlightsFinisher = {
        moments: decision.moments,
        originalDurationSeconds,
        finalDurationSeconds: selectionDurationS(footage),
      }
      await specialistEvent(ctx, budget, 'footage', 'highlights_finisher_handoff', {
        beforeSeconds: originalDurationSeconds,
        afterSeconds: highlightsFinisher.finalDurationSeconds,
        moments: footage.length,
        landings: highlightsFinisher.moments.map(m => [m.landing.startMs,m.landing.endMs]),
      })
    } catch (error) {
      // Preserve the originally sourced moments; never pretend their dialogue
      // has been polished when the Finisher cannot verify spoken landings.
      await specialistEvent(ctx, budget, 'footage', 'highlights_finisher_unavailable', {
        errorCode: String((error as Error)?.message ?? error).slice(0,200),
      })
    }
  }
  let refined: Record<string, unknown>
  try {
    refined = await runEditorialRole(ctx, out, budget, 'dialogue', {
    ...base, storyOutline: outline, curatedSelections: footage,
    ...(finisher ? { verifiedPayoff: finisher.payoff, finisherEditorialReason: finisher.editorialReason } : {}),
    ...(highlightsFinisher ? { verifiedHighlightLandings: highlightsFinisher.moments.map(m => m.landing) } : {}),
    instruction: highlightsMode
      ? 'Preserve each DISTINCT curated highlight and its own verified source-spoken landing. Refine precise audio boundaries only. Never drop a curated moment, trim out its verified landing quote, start mid-phrase, or continue beyond the approved ending. Keep chronological, word-safe cuts and the approved total length.'
      : shortStory
      ? 'Refine the curated story without re-expanding it. Preserve the source-verified payoff and naturally complete ending chosen by Story Finisher when present. Do not remove the payoff, carry on into another topic, or extend outside curated footage. Protect precise phonemes and breaths; stay near the target duration.'
      : 'Refine whole-thought boundaries inside chosen footage; never select outside.',
    })
  } catch (error) {
    await specialistEvent(ctx, budget, 'dialogue', 'fallback_to_footage', {
      errorCode: String((error as Error)?.message ?? error).slice(0, 200),
      count: footage.length,
    })
    refined = { selections: footage }
  }
  let cutPlan = refined.selections as EditorialSelection[]
  // Dialogue can tighten joins, but must not silently erase the setup or payoff
  // that Footage already sourced. Prefer the fuller source-grounded selection
  // to an isolated excerpt when a requested short would otherwise collapse.
  const dialogueCoverage = shortStory
    ? shortStoryCoverage(cutPlan, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
    : null
  const curatedCoverage = shortStory
    ? shortStoryCoverage(footage, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
    : null
  if (shortStory && dialogueCoverage && curatedCoverage &&
      selectionDurationS(footage) <= maximumSeconds + 3 &&
      (selectionDurationS(cutPlan) < minimumSeconds * 0.8 && selectionDurationS(footage) > selectionDurationS(cutPlan) + 5 ||
       dialogueCoverage.localOnly && !curatedCoverage.localOnly ||
       !dialogueCoverage.terminalSentence && curatedCoverage.terminalSentence &&
         selectionDurationS(footage) >= selectionDurationS(cutPlan) * 0.8)) {
    await specialistEvent(ctx, budget, 'dialogue', 'restored_curated_story', {
      dialogueSeconds: selectionDurationS(cutPlan),
      restoredSeconds: selectionDurationS(footage),
      reason: 'dialogue_removed_required_story_or_duration',
    })
    cutPlan = footage
  }
  if (highlightsMode) {
    const approved = highlightsCoverage(footage, ctx.config.targetLengthS)
    const refinedCoverage = highlightsCoverage(cutPlan, ctx.config.targetLengthS)
    // Dialogue may refine boundaries but must not silently discard a distinct
    // highlight chosen by the scouting agent.
    if (approved.distinctMomentCount > refinedCoverage.distinctMomentCount ||
        (approved.durationSeconds >= minimumSeconds &&
         refinedCoverage.durationSeconds < minimumSeconds * 0.8)) {
      await specialistEvent(ctx, budget, 'dialogue', 'restored_curated_highlights', {
        approved, refined: refinedCoverage,
      })
      cutPlan = footage
    }
    const finalCoverage = highlightsCoverage(cutPlan, ctx.config.targetLengthS)
    if (finalCoverage.needsRevision) {
      await specialistEvent(ctx, budget, 'dialogue', 'highlights_best_effort', {
        ...finalCoverage, note: 'Preserve editable draft; highlight diversity or length remains below target.',
      })
    }
  }
  if (finisher) {
    const payoff = finisher.payoff
    const last = cutPlan[cutPlan.length - 1]
    const retained = cutPlan.some(s =>
      s.startMs <= payoff.startMs && s.endMs >= payoff.endMs)
    const endsSoonAfter = Boolean(last && last.endMs - payoff.endMs <= 8000 &&
      last.endMs >= payoff.endMs)
    if (!retained || !endsSoonAfter) {
      await specialistEvent(ctx, budget, 'dialogue', 'restored_story_finisher', {
        reason: retained ? 'dialogue_overran_verified_payoff' : 'dialogue_removed_verified_payoff',
      })
      cutPlan = footage
    }
  }
  if (highlightsFinisher) {
    // Dialogue may adjust word edges but cannot undo the Finisher's verified
    // per-highlight decisions or return to the original overlong passages.
    const originals = highlightsFinisher.moments
    const preserved = cutPlan.length === originals.length &&
      originals.every((m,i) => {
        const s = cutPlan[i]
        return Boolean(s && s.startMs >= m.selection.startMs &&
          s.endMs <= m.selection.endMs &&
          s.startMs <= m.landing.startMs &&
          s.endMs >= m.landing.endMs &&
          s.endMs - m.landing.endMs <= 4_000)
      })
    if (!preserved) {
      await specialistEvent(ctx, budget, 'dialogue', 'restored_finished_highlights', {
        reason: 'dialogue_removed_moment_or_landing_or_extended_approved_range',
        approvedCount: originals.length, dialogueCount: cutPlan.length,
      })
      cutPlan = footage
    }
  }
  // Recheck the ACTUAL post-Dialogue result before handing it to assembly.
  // A clean Finisher proposal can be ruined by a later model's boundary edits.
  // Restore the verified Finisher plan instead of silently publishing a
  // syntactically legal but mid-thought cut.
  if (finisher || highlightsFinisher) {
    const { verifyFinishedThoughts } = await import('@/lib/ai-producer-agent/story-finisher')
    try {
      verifyFinishedThoughts(cutPlan, ctx.cache.words ?? [])
    } catch (error) {
      await specialistEvent(ctx, budget, 'dialogue', 'restored_complete_sentences', {
        reason: String((error as Error)?.message ?? error).slice(0, 200),
      })
      cutPlan = footage
    }
  }
  const duration = selectionDurationS(cutPlan)
  const [lo, hi] = ctx.config.targetLengthS
  if (duration < lo || duration > hi) {
    if (shortStory && duration < lo * 0.8) {
      await specialistEvent(ctx, budget, 'dialogue', 'story_incomplete_best_effort', {
        actualSeconds: duration, minimumSeconds: lo, cuts: cutPlan.length,
        note: 'Source-grounded editable draft preserved; target not achieved.',
      })
    }
    await specialistEvent(ctx, budget, 'dialogue', 'handoff_duration_advisory', {
      actualSeconds: duration, minimumSeconds: lo, maximumSeconds: hi,
      note: 'Deliver the best coherent editable cut even when shorter or longer than requested.',
    })
  }
  return { outline, footage, cutPlan, ...(finisher ? { finisher } : {}), ...(highlightsFinisher ? { highlightsFinisher } : {}) }
}

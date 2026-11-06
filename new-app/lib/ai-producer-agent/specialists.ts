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

export type EditorialRole = 'story' | 'footage' | 'dialogue' | 'qa'
export type EditorialSelection = {
  startMs: number
  endMs: number
  beat: string
  reason: string
}
export type EditorialHandoff = {
  outline: { logline: string; beats: string[]; audiencePromise: string }
  footage: EditorialSelection[]
  cutPlan: EditorialSelection[]
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
      },
      required: ['logline', 'audiencePromise', 'beats'],
    },
  },
  footage: {
    name: names.footage,
    description: 'Submit grounded, chronological candidate source intervals covering a complete rough cut.',
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
): EditorialSelection[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) throw new Error('specialist_invalid_selection_count')
  const normalized: EditorialSelection[] = raw.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('specialist_invalid_selection')
    const r = entry as Record<string, unknown>
    const { startMs, endMs, beat, reason } = r
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) ||
      typeof startMs !== 'number' || typeof endMs !== 'number' ||
      startMs < bounds[0] || endMs > bounds[1] || endMs - startMs < 3000 ||
      typeof beat !== 'string' || typeof reason !== 'string' ||
      !reason.trim()) throw new Error('specialist_invalid_source_range')
    // Require transcript evidence for the proposed actual source.
    const matches = words.filter((w) => w.e * 1000 > startMs && w.s * 1000 < endMs)
    if (matches.length < 5) throw new Error('specialist_range_has_no_speech_evidence')
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
): EditorialSelection[] {
  try { return validSelections(raw, bounds, words, allowed) } catch (error) {
    if (!Array.isArray(raw) || raw.length < 2 || raw.length > 24) throw error
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
    return validSelections(repaired, bounds, words, allowed)
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
  // ASR from some providers has no punctuation at all: don't mistake that
  // absence of metadata for evidence that every sentence is unfinished.
  const punctuationAvailable = words.some(w => /[.!?][\"'”’]?$/.test(w.w))
  const enoughSourceToExplore = sourceRange[1] - sourceRange[0] >= 3 * 60_000
  const localOnly = enoughSourceToExplore &&
    sourceSpanMs <= Math.max(90_000, target[1] * 1000 * 1.2) &&
    longestSourceGapMs < 8_000
  return {
    durationSeconds, sourceSpanMs, longestSourceGapMs,
    lastWord, terminalSentence,
    localOnly,
    underTarget: durationSeconds < target[0],
    needsReview: durationSeconds < target[0] || (punctuationAvailable && !terminalSentence) || localOnly,
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
): EditorialSelection[] {
  return validSelections(selections, bounds, words, allowed)
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
      'Tools are restricted by your role. Do not invent tool results. Submit one structured response with your submit tool.',
      'Work in original absolute source milliseconds. Do not flatten or export.',
    ].join('\n\n') },
    { role: 'user', content: JSON.stringify({
      ...context, sourceId: source.sourceId, sourceRangeMs: source.rangeMs,
      outputTargetSeconds: ctx.config.targetLengthS,
      editingIntent: ctx.config.targetLengthS[1] <= 105 ? 'short_highlight' : 'conversational_long_form',
      ...((role === 'footage' || role === 'dialogue')
        ? { selectionDurationInstruction: 'Select enough sourced material for the specified target duration, retaining the beginning, essential development and payoff. Do not submit a lone isolated excerpt as a complete story. If there is truly insufficient relevant footage, submit the best complete edit without padding; the system will preserve that draft.' }
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
              args.beats.length > 10 || !args.beats.every((b) => typeof b === 'string')) {
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
  const base = {
    instruction,
    transcriptSamples: representativeTranscript(ctx.cache.words, source.rangeMs),
    observedMoments: ctx.cache.momentsSummary,
    inventory: ctx.cache.inventorySummary,
    audienceGoal: ctx.config.targetLengthS[1] <= 105
      ? 'A standalone short-form story with an understandable setup, development and payoff, targeting the requested duration'
      : 'A coherent conversational long-form edit preserving context and natural pacing',
    editingPriorities: ['meaning and context','narrative payoff','natural dialogue and reactions','no repetition','restrained polish'],
  }
  let story: Record<string, unknown>
  try {
    story = await runEditorialRole(ctx, out, budget, 'story', base)
  } catch (error) {
    // An unavailable paper outline must not destroy a sourced editable draft.
    await specialistEvent(ctx, budget, 'story', 'fallback', {
      errorCode: String((error as Error)?.message ?? error).slice(0, 200),
    })
    story = { logline: 'Source-grounded conversational rough cut',
      audiencePromise: 'Review the best available recorded conversation',
      beats: ['context', 'discussion', 'resolution'] }
  }
  const outline = {
    logline: String(story.logline),
    audiencePromise: String(story.audiencePromise),
    beats: (story.beats as string[]).slice(0, 10),
  }
  let found: Record<string, unknown>
  try {
    found = await runEditorialRole(ctx, out, budget, 'footage', {
      ...base, storyOutline: outline,
      instruction: ctx.config.targetLengthS[1] <= 105
        ? 'SHORT FILM PAPER EDIT: First compare events and conversations across the entire source window. Choose one truthful story with setup, turning point and payoff, sourcing each beat from anywhere relevant in the 20 minutes. Do NOT take a nearly continuous 60–90 second stretch simply because it is easy to fill the requested time. Different recordings can support one story; here use separate ranges from the same recording whenever the narrative needs them. Editorial judgment is allowed: reorder ideas in your outline, but keep selected footage chronological and never invent connections. End at a finished sentence or genuine payoff. Select only relevant material.'
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
  const shortStory = ctx.config.editMode === 'just_chatting_rough_cut' && maximumSeconds <= 105
  // One targeted *editorial* retry instead of accepting a 20s excerpt as a
  // requested 90s story. Preserve original cuts if the revision is worse.
  const firstCoverage = shortStory
    ? shortStoryCoverage(footage, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
    : null
  if (firstCoverage?.needsReview && budget.state() !== 'hard') {
    const beforeSeconds = selectionDurationS(footage)
    try {
      const revised = await runEditorialRole(ctx, out, budget, 'footage', {
        ...base, storyOutline: outline,
        previousSelections: footage,
        previousDurationSeconds: beforeSeconds,
        previousCoverage: firstCoverage,
        missingSecondsToMinimum: Math.max(0, Math.round(minimumSeconds - beforeSeconds)),
        instruction: 'EDITORIAL REVISION: The initial cut is short, locally concentrated, or ends without a complete thought. Explore the FULL allowed source (not just the first selected minute) and identify stronger evidence for SETUP → DEVELOPMENT → PAYOFF. Find meaningful later/earlier passages and propose source-grounded cuts across the recording where appropriate. Do NOT merely pad with neighboring conversation; complete the story with a coherent, sentence-complete ending. Preserve useful existing moments and only replace when the story is demonstrably stronger. Chronological source order and truthful context required.',
      })
      const candidates = revised.selections as EditorialSelection[]
      const candidateSeconds = selectionDurationS(candidates)
      const candidateCoverage = shortStoryCoverage(candidates, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
      // Do not replace a reasonable existing edit with a longer but weaker
      // single excerpt. A complete ending or meaningful broader coverage can
      // justify a shorter alternative; adding arbitrary seconds cannot.
      const improvesEnding = !firstCoverage.terminalSentence && candidateCoverage.terminalSentence
      const improvesCoverage = firstCoverage.localOnly && !candidateCoverage.localOnly
      const improvesDuration = candidateSeconds >= minimumSeconds &&
        beforeSeconds < minimumSeconds && !candidateCoverage.localOnly
      const notWorse = candidateSeconds >= Math.min(beforeSeconds * 0.75, minimumSeconds * 0.8)
      if (notWorse && candidateSeconds <= maximumSeconds * 1.5 &&
          (improvesEnding || improvesCoverage || improvesDuration ||
           (candidateSeconds > beforeSeconds + 5 && !candidateCoverage.localOnly))) {
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
  let refined: Record<string, unknown>
  try {
    refined = await runEditorialRole(ctx, out, budget, 'dialogue', {
    ...base, storyOutline: outline, curatedSelections: footage,
    instruction: shortStory
      ? 'Refine the WHOLE multi-beat story, not one local anecdote. Keep sourced setup, development and payoff from the curated passages. Finish on a full sentence or deliberate resolved beat; avoid ellipses or trailing conjunctions. Never extend outside curated footage. Do not delete necessary beats just to tighten pacing.'
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
  return { outline, footage, cutPlan }
}

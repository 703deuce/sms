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
    description: 'Submit final whole-thought cutting boundaries inside the curated intervals; 3-8min total.',
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
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 24) throw new Error('specialist_invalid_selection_count')
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
      if (words.some((w) => edge > w.s * 1000 + 30 && edge < w.e * 1000 - 30)) {
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
): number | null {
  const lo = Math.max(bounds[0], allowedRange?.[0] ?? bounds[0])
  const hi = Math.min(bounds[1], allowedRange?.[1] ?? bounds[1])
  if (edge < lo || edge > hi) return null
  const spans = words
    .filter((w) => Number.isFinite(w.s) && Number.isFinite(w.e) && w.e > w.s)
    .map((w) => [Math.floor(w.s * 1000), Math.ceil(w.e * 1000)] as const)
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
    if (Math.abs(start - edge) <= 1500) candidates.add(Math.max(lo, start - 30))
    if (Math.abs(end - edge) <= 1500) candidates.add(Math.min(hi, end + 30))
  }
  const legal = [...candidates].filter((c) =>
    c >= lo && c <= hi && Math.abs(c - edge) <= 1500 &&
    !merged.some(([start, end]) => c > start + 30 && c < end - 30))
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
        ? [JUST_CHATTING_EDITORIAL_DIRECTION, JUST_CHATTING_ROLE_DIRECTION[role]] : []),
      'Tools are restricted by your role. Do not invent tool results. Submit one structured response with your submit tool.',
      'Work in original absolute source milliseconds. Do not flatten or export.',
    ].join('\n\n') },
    { role: 'user', content: JSON.stringify({
      ...context, sourceId: source.sourceId, sourceRangeMs: source.rangeMs,
      outputTargetSeconds: ctx.config.targetLengthS,
      ...(role === 'qa' && ctx.config.editMode === 'just_chatting_rough_cut'
        ? { requiredReviewChecks: JUST_CHATTING_REVIEW_CHECKS } : {}),
    }) },
  ]
  let transcriptReads = 0
  let invalidSubmissions = 0
  await specialistEvent(ctx, budget, role, 'start', {\n    wordCount: ctx.cache.words?.length ?? 0, sourceRangeMs: source.rangeMs,\n    allowedCount: Array.isArray(context.curatedSelections) ? context.curatedSelections.length : undefined,\n  })\n  for (let turn = 0; turn < 10; turn++) {
    if (budget.state() === 'hard') throw new Error('specialist_budget_exhausted')
    // Reserve the last half of the budget for a structured handoff, not
    // repeated transcript searches. The initial context already includes
    // inventory plus twelve chronological transcript samples.
    const mustSubmit = turn >= 5 || transcriptReads >= 3 || invalidSubmissions >= 2
    const turnTools = mustSubmit ? [submitSchemas[role]] : tools
    await specialistEvent(ctx, budget, role, 'turn', { turn, transcriptReads, invalidSubmissions, forcedSubmit: mustSubmit, allowedTools: turnTools.map((t) => t.name) })\n    const response = await lunaChat({ messages, tools: turnTools, toolChoice: 'required' })
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
      const args = safeJson(call.function.arguments)\n      if (name === names[role]) await specialistEvent(ctx, budget, role, 'submit_attempt', {\n        turn, callId: call.id, proposal: selectionLogSummary(args),\n        malformedJson: args === null,\n      })
      if (name === names[role] && args) {
        try {
        if (role === 'story') {
          if (typeof args.logline !== 'string' || typeof args.audiencePromise !== 'string' ||
              !Array.isArray(args.beats) || args.beats.length < 3 ||
              args.beats.length > 10 || !args.beats.every((b) => typeof b === 'string')) {
            throw new Error('specialist_story_outline_invalid')
          }
          await specialistEvent(ctx, budget, role, 'accepted', { turn, beatCount: args.beats.length })\n          return args\n        }\n        if (role === 'footage' || role === 'dialogue') {
          const allowed = role === 'dialogue'
            ? context.curatedSelections as EditorialSelection[] | undefined
            : undefined
          const selections = snapEditorialSelections(args.selections, source.rangeMs, ctx.cache.words ?? [], allowed)\n          await specialistEvent(ctx, budget, role, 'accepted', { turn, proposal: selectionLogSummary(args),\n            accepted: selections.map((s) => [s.startMs, s.endMs]),\n            movedEdges: selections.filter((s, i) => s.startMs !== (args.selections as EditorialSelection[])[i]?.startMs ||\n              s.endMs !== (args.selections as EditorialSelection[])[i]?.endMs).length,\n          })\n          return { selections }
        }
        if (typeof args.pass !== 'boolean' || !Array.isArray(args.issues) ||
            !args.issues.every((i) => typeof i === 'string')) {
          throw new Error('specialist_review_invalid')
        }
        await specialistEvent(ctx, budget, role, 'accepted', { turn, pass: args.pass, issueCount: args.issues.length })\n        return { pass: args.pass, issues: args.issues.slice(0, 15) }
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
          messages.push({
            role: 'tool', tool_call_id: call.id,
            content: JSON.stringify({
              ok: false,
              error: errorCode,\n              repairHint,
              instruction: 'Do not call get_transcript again. Correct and resubmit using legal source word edges.',
            }),
          })
          continue
        }
      }
      // Enforce read-only tools even if the model hallucinates a tool name.
      if (!readTools[role].includes(name)) {\n        await specialistEvent(ctx, budget, role, 'forbidden_tool', { turn, name })
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
  await specialistEvent(ctx, budget, role, 'exhausted', { transcriptReads, invalidSubmissions },\n    `specialist_${role}_did_not_submit`)\n  throw new Error(`specialist_${role}_did_not_submit_after_${invalidSubmissions}_invalid_attempts`)
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
      excerpt: hits.slice(0, 45).map((w) => w.w).join(' ').slice(0, 550),
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
    audienceGoal: 'Coherent conversational 3–8 minute editable stream edit, never a shorts montage',
    editingPriorities: ['meaning and context','narrative payoff','natural dialogue and reactions','no repetition','restrained polish'],
  }
  const story = await runEditorialRole(ctx, out, budget, 'story', base)
  const outline = {
    logline: String(story.logline),
    audiencePromise: String(story.audiencePromise),
    beats: (story.beats as string[]).slice(0, 10),
  }
  const found = await runEditorialRole(ctx, out, budget, 'footage', {
    ...base, storyOutline: outline,
    instruction: 'Select coherent source intervals; evidence first, then editorial value.',
  })
  const footage = found.selections as EditorialSelection[]
  const refined = await runEditorialRole(ctx, out, budget, 'dialogue', {
    ...base, storyOutline: outline, curatedSelections: footage,
    instruction: 'Refine whole-thought boundaries inside chosen footage; never select outside.',
  })
  const cutPlan = refined.selections as EditorialSelection[]
  const duration = cutPlan.reduce((sum, s) => sum + s.endMs - s.startMs, 0) / 1000
  const [lo, hi] = ctx.config.targetLengthS
  if (duration < lo || duration > hi) throw new Error('specialist_cut_plan_duration_outside_target')
  return { outline, footage, cutPlan }
}

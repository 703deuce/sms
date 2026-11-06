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
 * Only repair minor timestamp quantization, not arbitrary model selections.
 * A snapping candidate must still satisfy every speech, chronology and
 * curated-footage validator after repair.
 */
export function snapEditorialSelections(
  raw: unknown,
  bounds: [number, number],
  words: ClipWord[],
  allowed?: EditorialSelection[],
): EditorialSelection[] {
  try { return validSelections(raw, bounds, words, allowed) } catch (error) {
    if (!Array.isArray(raw) || raw.length < 2 || raw.length > 24) throw error
    const inside = (edge: number) => words.find((w) =>
      edge > w.s * 1000 + 30 && edge < w.e * 1000 - 30)
    const repaired = raw.map((value) => {
      if (!value || typeof value !== 'object') return value
      const item = value as EditorialSelection
      if (!Number.isInteger(item.startMs) || !Number.isInteger(item.endMs)) return value
      let startMs = item.startMs
      let endMs = item.endMs
      const startWord = inside(startMs)
      const endWord = inside(endMs)
      if (startWord) {
        const candidate = Math.max(bounds[0], Math.floor(startWord.s * 1000) - 30)
        if (startMs - candidate <= 300) startMs = candidate
      }
      if (endWord) {
        const candidate = Math.min(bounds[1], Math.ceil(endWord.e * 1000) + 30)
        if (candidate - endMs <= 300) endMs = candidate
      }
      return { ...item, startMs, endMs }
    })
    return validSelections(repaired, bounds, words, allowed)
  }
}

function selectionRepairHint(
  raw: unknown, words: ClipWord[], bounds: [number, number],
): Record<string, unknown> {
  if (!Array.isArray(raw)) return { instruction: 'Submit 2–24 intervals.' }
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as EditorialSelection | null
    if (!r || !Number.isInteger(r.startMs) || !Number.isInteger(r.endMs)) {
      return { index: i, instruction: 'Use integer source milliseconds.' }
    }
    for (const edge of ['startMs', 'endMs'] as const) {
      const t = r[edge]
      const w = words.find((w) => t > w.s * 1000 + 30 && t < w.e * 1000 - 30)
      if (w) return {
        index: i, edge, suppliedMs: t,
        nearestLegalWordEdgesMs: [
          Math.max(bounds[0], Math.floor(w.s * 1000) - 30),
          Math.min(bounds[1], Math.ceil(w.e * 1000) + 30),
        ],
      }
    }
    const speechCount = words.filter((w) => w.e * 1000 > r.startMs && w.s * 1000 < r.endMs).length
    if (speechCount < 5) return { index: i, speechCount, instruction: 'Choose a transcript-grounded spoken interval.' }
  }
  return { instruction: 'Check chronology, minimum 3 seconds and source bounds.' }
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
  for (let turn = 0; turn < 10; turn++) {
    if (budget.state() === 'hard') throw new Error('specialist_budget_exhausted')
    // Reserve the last half of the budget for a structured handoff, not
    // repeated transcript searches. The initial context already includes
    // inventory plus twelve chronological transcript samples.
    const mustSubmit = turn >= 5 || transcriptReads >= 3 || invalidSubmissions >= 2
    const turnTools = mustSubmit ? [submitSchemas[role]] : tools
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
      if (name === names[role] && args) {
        try {
        if (role === 'story') {
          if (typeof args.logline !== 'string' || typeof args.audiencePromise !== 'string' ||
              !Array.isArray(args.beats) || args.beats.length < 3 ||
              args.beats.length > 10 || !args.beats.every((b) => typeof b === 'string')) {
            throw new Error('specialist_story_outline_invalid')
          }
          return args
        }
        if (role === 'footage' || role === 'dialogue') {
          const allowed = role === 'dialogue'
            ? context.curatedSelections as EditorialSelection[] | undefined
            : undefined
          return { selections: snapEditorialSelections(args.selections, source.rangeMs, ctx.cache.words ?? [], allowed) }
        }
        if (typeof args.pass !== 'boolean' || !Array.isArray(args.issues) ||
            !args.issues.every((i) => typeof i === 'string')) {
          throw new Error('specialist_review_invalid')
        }
        return { pass: args.pass, issues: args.issues.slice(0, 15) }
        } catch (error) {
          invalidSubmissions++
          // Models sometimes choose an imprecise word boundary. Reject the
          // proposal but give this specialist a chance to repair it before
          // the entire twenty-minute run fails.
          messages.push({
            role: 'tool', tool_call_id: call.id,
            content: JSON.stringify({
              ok: false,
              error: String((error as Error)?.message ?? error).slice(0, 240),
              repairHint: selectionRepairHint(args.selections, ctx.cache.words ?? [], source.rangeMs),
              instruction: 'Do not call get_transcript again. Correct and resubmit using legal source word edges.',
            }),
          })
          continue
        }
      }
      // Enforce read-only tools even if the model hallucinates a tool name.
      if (!readTools[role].includes(name)) {
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

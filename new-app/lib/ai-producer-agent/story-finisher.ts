import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import type { Budget } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import { logAiProducerStep } from '@/lib/ai-producer-agent/log'
import { checkEditorialSelections, snapEditorialSelections, type EditorialSelection, type EditorialOutline, type FootagePreferredEdit } from '@/lib/ai-producer-agent/specialists'
import type { ToolSchema } from '@/lib/ai-producer-agent/tools/schemas'
import { wordAtUnsafeBoundary } from '@/lib/ai-producer-agent/validate'

export type StoryPayoff = { startMs: number; endMs: number; quote: string }
export type StoryFinisherDecision = {
  selections: EditorialSelection[]
  payoff: StoryPayoff
  editorialReason: string
}
const submission: ToolSchema = {
  name: 'submit_story_finish',
  description: 'Commit an evidence-grounded concise story, with an exact sourced payoff and an ending after it.',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      selections: {
        type: 'array', minItems: 1, maxItems: 24,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            startMs: { type: 'integer', minimum: 0 },
            endMs: { type: 'integer', minimum: 0 },
            beat: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['startMs','endMs','beat','reason'],
        },
      },
      payoff: {
        type: 'object', additionalProperties: false,
        properties: {
          startMs: { type: 'integer', minimum: 0 },
          endMs: { type: 'integer', minimum: 0 },
          quote: { type: 'string' },
        },
        required: ['startMs','endMs','quote'],
      },
      editorialReason: { type: 'string' },
    },
    required: ['selections','payoff','editorialReason'],
  },
}

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const seconds = (selections: EditorialSelection[]) =>
  selections.reduce((n, s) => n + (s.endMs - s.startMs), 0) / 1000

/** A curator may cut off the answer. Give the LLM a small amount of actual
 * source before/after each selected event, not permission to invent material
 * or jump to a completely different conversation. */
export const FINISHER_CONTEXT_EXTENSION_MS = 15_000
function extendedRanges(selections: EditorialSelection[], bounds: [number, number]): EditorialSelection[] {
  return selections.map(s => ({
    ...s,
    startMs: Math.max(bounds[0], s.startMs - FINISHER_CONTEXT_EXTENSION_MS),
    endMs: Math.min(bounds[1], s.endMs + FINISHER_CONTEXT_EXTENSION_MS),
  }))
}

/** All authorized words, each with original source timestamps. Never sample or
 * truncate: a 20-minute source is inexpensive text compared with video.
 */
export function fullFinisherTranscript(words: ClipWord[], bounds: [number, number]) {
  return words.filter(w => Number.isFinite(w.s) && Number.isFinite(w.e) &&
    w.e * 1000 > bounds[0] && w.s * 1000 < bounds[1])
    .sort((a, b) => a.s - b.s)
    .map(w => [Math.round(w.s * 1000), Math.round(w.e * 1000), w.w] as const)
}

/** Structural evidence only; linguistic completion belongs to the LLM. */
export function verifyFinishedThoughts(selections: EditorialSelection[], words: ClipWord[]): void {
  for (const selection of selections) {
    if (words.filter(w => w.e * 1000 > selection.startMs && w.s * 1000 < selection.endMs).length < 2)
      throw new Error('finisher_segment_without_speech')
  }
}

/** Repair only tiny timestamp drift, never bridge a source gap or silently
 * reinterpret a proposed story. The LLM must resubmit genuinely new footage. */
export function repairFinisherEdges(raw: unknown, allowed: EditorialSelection[]): unknown {
  if (!Array.isArray(raw)) return raw
  return raw.map((item: unknown) => {
    if (!item || typeof item !== 'object') return item
    const selection = item as EditorialSelection
    if (!Number.isInteger(selection.startMs) || !Number.isInteger(selection.endMs)) return item
    // Only snap near the SAME curated interval, and never collapse a passage.
    const match = allowed.find(a =>
      selection.startMs >= a.startMs - 250 && selection.endMs <= a.endMs + 250 &&
      selection.endMs > a.startMs && selection.startMs < a.endMs)
    if (!match) return item
    const startMs = Math.max(match.startMs, selection.startMs)
    const endMs = Math.min(match.endMs, selection.endMs)
    if (endMs - startMs < 3000) return item
    return { ...selection, startMs, endMs }
  })
}

/** Safe per-interval diagnostics: let the LLM repair the offending timestamp
 * without revealing transcripts or allowing a cut across excluded material. */
export function finisherRepairHint(raw: unknown, footage: EditorialSelection[], bounds: [number, number], target?: [number, number]) {
  const allowed = extendedRanges(footage, bounds)
  if (!Array.isArray(raw)) return { instruction: 'Submit valid chronological sourced intervals.' }
  const invalid = raw.flatMap((value: unknown, index: number) => {
    if (!value || typeof value !== 'object') return [{ index, problem: 'invalid_selection' }]
    const s = value as EditorialSelection
    if (!Number.isInteger(s.startMs) || !Number.isInteger(s.endMs) || s.endMs <= s.startMs ||
        s.startMs < bounds[0] || s.endMs > bounds[1])
      return [{ index, problem: 'invalid_source_range', proposed: [s.startMs,s.endMs] }]
    if (typeof s.beat !== 'string' || typeof s.reason !== 'string' || !s.reason.trim())
      return [{ index, problem: 'missing_beat_or_reason' }]
    if (s.endMs - s.startMs < 400)
      return [{ index, problem: 'too_short_to_play', durationMs: s.endMs - s.startMs }]
    if (allowed.some(a => s.startMs >= a.startMs && s.endMs <= a.endMs)) return []
    const nearest = [...allowed].sort((a,b) =>
      Math.abs(a.startMs-s.startMs)+Math.abs(a.endMs-s.endMs) -
      Math.abs(b.startMs-s.startMs)-Math.abs(b.endMs-s.endMs))[0]
    return [{ index, problem: 'outside_curated_footage', proposed: [s.startMs,s.endMs],
      nearestAllowed: nearest ? [nearest.startMs,nearest.endMs] : null }]
  })
  const totalSeconds = raw.reduce((sum: number, value: unknown) => {
    const s = value as EditorialSelection | null
    return sum + (s && Number.isFinite(s.startMs) && Number.isFinite(s.endMs) &&
      s.endMs > s.startMs ? (s.endMs - s.startMs) / 1000 : 0)
  }, 0)
  const overSeconds = target ? Math.max(0, totalSeconds - target[1]) : 0
  return { invalid: invalid.slice(0,24), totalSeconds,
    ...(overSeconds ? { overSeconds: Number(overSeconds.toFixed(2)) } : {}),
    instruction: invalid.length
      ? 'Repair ONLY listed invalid pieces. Keep meaningful short reactions (at least 0.4s); drop unusably tiny clips, fix missing beat/reason, and split any range crossing unrelated source. Do not discard the otherwise valid story.'
      : overSeconds
        ? 'Cut approximately ' + overSeconds.toFixed(1) + ' seconds of optional setup or repetition, keeping the authentic final payoff. A near miss within 3 seconds over maximum is acceptable; do not blindly trim the ending.'
        : 'All ranges are in authorized footage; if rejected, inspect source word-edge, payoff, and chronological constraints rather than moving to another source window.' }
}

/** Only accept a payoff actually spoken inside the final approved picture edit.
 * No fictional success, no arbitrary sentence cutoff and no slipping beyond
 * Footage's sourced candidate intervals.
 */
export function verifyStoryFinish(
  proposal: unknown, footage: EditorialSelection[], words: ClipWord[],
  bounds: [number, number], target: [number, number],
): StoryFinisherDecision {
  if (!proposal || typeof proposal !== 'object') throw new Error('finisher_invalid_submission')
  const p = proposal as Record<string, unknown>
  const allowed = extendedRanges(footage, bounds)
  const selections = snapEditorialSelections(repairFinisherEdges(p.selections, allowed), bounds, words, allowed, 400)
  checkEditorialSelections(selections, bounds, words, allowed, 400)
  if (!selections.length || typeof p.editorialReason !== 'string' || !p.editorialReason.trim()) {
    throw new Error('finisher_missing_editorial_decision')
  }
  if (!p.payoff || typeof p.payoff !== 'object') throw new Error('finisher_missing_payoff')
  const payoff = p.payoff as StoryPayoff
  if (!Number.isInteger(payoff.startMs) || !Number.isInteger(payoff.endMs) ||
      payoff.endMs <= payoff.startMs || payoff.endMs - payoff.startMs > 15_000 ||
      typeof payoff.quote !== 'string' || normalized(payoff.quote).split(' ').length < 2) {
    throw new Error('finisher_invalid_payoff')
  }
  if (!selections.some(s => s.startMs <= payoff.startMs && s.endMs >= payoff.endMs)) {
    throw new Error('finisher_payoff_not_retained')
  }
  const payoffSpeech = words.filter(w =>
    w.e * 1000 > payoff.startMs - 150 && w.s * 1000 < payoff.endMs + 150)
    .sort((a, b) => a.s - b.s).map(w => w.w).join(' ')
  if (!normalized(payoffSpeech).includes(normalized(payoff.quote))) {
    throw new Error('finisher_unsourced_payoff_quote')
  }
  const last = selections[selections.length - 1]!
  // Allow a natural brief reaction after the payoff, not another 99 seconds
  // of new subject matter. A different narrative may justify a longer edit,
  // but then the model must identify the actual later payoff instead.
  if (last.endMs - payoff.endMs > 8_000) throw new Error('finisher_kept_conversation_after_payoff')
  // The Finisher reads the entire conversation and judges complete thoughts.
  // Code verifies source-grounded selections, not grammar via a word blacklist.
  verifyFinishedThoughts(selections, words)
  const duration = seconds(selections)
  // A one-to-three-second near miss is a good edit, not a reason to discard it.
  // Keep the complete thought instead of blindly shaving speech from the payoff.
  if (duration > target[1] + 3) throw new Error('finisher_still_over_target')
  // Avoid a technically valid two-second soundbite framed as a complete story.
  if (duration < Math.max(25, target[0] * 0.75)) throw new Error('finisher_overshort_story')
  return { selections, payoff: {
    startMs: payoff.startMs, endMs: payoff.endMs, quote: payoff.quote.slice(0, 180),
  }, editorialReason: p.editorialReason.slice(0, 500) }
}

/** The Highlights variant of the Finisher does NOT require one shared story payoff.
 * Each original curated moment is retained, given its own spoken landing,
 * and compressed independently without changing source order.
 */
export type HighlightFinish = {
  selection: EditorialSelection
  landing: StoryPayoff
  editorialReason: string
}
export type HighlightsFinisherDecision = {
  selections: EditorialSelection[]
  moments: HighlightFinish[]
  editorialReason: string
}
const highlightMomentSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    selection: {
      type: 'object', additionalProperties: false,
      properties: {
        startMs: { type: 'integer', minimum: 0 },
        endMs: { type: 'integer', minimum: 0 },
        beat: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['startMs', 'endMs', 'beat', 'reason'],
    },
    landing: {
      type: 'object', additionalProperties: false,
      properties: {
        startMs: { type: 'integer', minimum: 0 },
        endMs: { type: 'integer', minimum: 0 },
        quote: { type: 'string' },
      },
      required: ['startMs', 'endMs', 'quote'],
    },
    editorialReason: { type: 'string' },
  },
  required: ['selection', 'landing', 'editorialReason'],
}
const highlightsSubmission: ToolSchema = {
  name: 'submit_highlights_finish',
  description: 'Submit a separately completed, source-grounded excerpt and spoken landing for every curated highlight.',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      moments: { type: 'array', minItems: 2, maxItems: 24, items: highlightMomentSchema },
      editorialReason: { type: 'string' },
    },
    required: ['moments', 'editorialReason'],
  },
}
function sourceWords(words: ClipWord[], startMs: number, endMs: number): ClipWord[] {
  return words.filter(w => w.e * 1000 > startMs && w.s * 1000 < endMs)
    .sort((a,b) => a.s - b.s)
}
function verifySpokenQuote(words: ClipWord[], landing: StoryPayoff): void {
  if (!Number.isInteger(landing.startMs) || !Number.isInteger(landing.endMs) ||
      landing.endMs <= landing.startMs || landing.endMs - landing.startMs > 12_000 ||
      typeof landing.quote !== 'string' || normalized(landing.quote).split(' ').length < 2) {
    throw new Error('highlights_finisher_invalid_landing')
  }
  const evidence = sourceWords(words, landing.startMs - 150, landing.endMs + 150)
    .map(w => w.w).join(' ')
  if (!normalized(evidence).includes(normalized(landing.quote))) {
    throw new Error('highlights_finisher_unsourced_landing')
  }
}
export function verifyHighlightsFinish(
  proposal: unknown, footage: EditorialSelection[], words: ClipWord[],
  bounds: [number, number], target: [number, number],
): HighlightsFinisherDecision {
  if (!proposal || typeof proposal !== 'object') throw new Error('highlights_finisher_invalid_submission')
  const p = proposal as Record<string, unknown>
  if (!Array.isArray(p.moments) || p.moments.length !== footage.length ||
      typeof p.editorialReason !== 'string' || !p.editorialReason.trim()) {
    throw new Error('highlights_finisher_must_keep_all_curated_moments')
  }
  const mapped: HighlightFinish[] = []
  for (let i=0;i<footage.length;i++) {
    const original = footage[i]!
    const raw = p.moments[i] as HighlightFinish | null
    if (!raw || typeof raw !== 'object' || !raw.selection ||
        !raw.landing || typeof raw.editorialReason !== 'string' || !raw.editorialReason.trim()) {
      throw new Error('highlights_finisher_invalid_moment')
    }
    // Separate guards per moment, not just one total EDL: every highlight must
    // survive and no highlight can grow into a previously skipped section.
    const selection = raw.selection
    const context = extendedRanges([original], bounds)[0]!
    if (!Number.isInteger(selection.startMs) || !Number.isInteger(selection.endMs) ||
        selection.startMs < context.startMs || selection.endMs > context.endMs ||
        selection.startMs < bounds[0] || selection.endMs > bounds[1]) {
      throw new Error('highlights_finisher_outside_curated_moment')
    }
    if (selection.endMs - selection.startMs < 3_000) throw new Error('highlights_finisher_moment_too_short')
    if (sourceWords(words, selection.startMs, selection.endMs).length < 5)
      throw new Error('highlights_finisher_no_speech_evidence')
    // In dense ASR the next word may begin the same millisecond the prior
    // one ends. Reject a true phoneme split; allow exact word transitions,
    // leaving 30ms acoustic caution to the final validator/human audition.
    if ([selection.startMs, selection.endMs].some(edge =>
      words.some(w => edge > Math.round(w.s * 1000) + 30 &&
        edge < Math.round(w.e * 1000) - 30))) {
      throw new Error('highlights_finisher_cut_inside_word')
    }
    if (raw.landing.startMs < selection.startMs || raw.landing.endMs > selection.endMs) {
      throw new Error('highlights_finisher_landing_not_retained')
    }
    verifySpokenQuote(words, raw.landing)
    if (selection.endMs - raw.landing.endMs > 4_000) {
      throw new Error('highlights_finisher_kept_talk_after_landing')
    }
    // This is a sourced, word-safe interval. Whether it is a satisfying
    // conversational ending is a language-model decision with full context.
    verifyFinishedThoughts([selection], words)
    mapped.push({
      selection, landing: {
        startMs: raw.landing.startMs, endMs: raw.landing.endMs,
        quote: raw.landing.quote.slice(0,180),
      }, editorialReason: raw.editorialReason.slice(0,350),
    })
  }
  const selections = mapped.map(m => m.selection)
  if (seconds(selections) > target[1] * 1.15) throw new Error('highlights_finisher_still_over_target')
  if (seconds(selections) < target[0] * 0.6) throw new Error('highlights_finisher_overshort')
  // Preserve the highlights' original diversity: one source interval per
  // curated distinct moment, in original chronological order.
  for (let i=1;i<selections.length;i++) {
    if (selections[i]!.startMs < selections[i-1]!.endMs)
      throw new Error('highlights_finisher_invalid_chronology')
  }
  return { selections, moments: mapped, editorialReason: p.editorialReason.slice(0,500) }
}

export async function runHighlightsFinisher(
  ctx: ToolCtx, budget: Budget,
  outline: EditorialOutline,
  footage: EditorialSelection[],
): Promise<HighlightsFinisherDecision> {
  const words = ctx.cache.words ?? []
  const source = ctx.sources[0]
  if (!source?.rangeMs || !words.length || footage.length < 2) throw new Error('highlights_finisher_source_unavailable')
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      'You are HIGHLIGHTS FINISHER, the same editorial completion specialist as Story Finisher, but with a DIFFERENT completion criterion.',
      'There is NO single shared narrative payoff. Each curated highlight must be independently interesting and comprehensible, with its own setup and source-spoken punchline, revelation, conclusion or natural landing. Use the Story creative brief for overall editorial taste, and the INDIVIDUAL moment intent to determine the correct separate ending of EACH moment. Verify every proposed landing is spoken and actually resolves that moment; an intent is NOT evidence.',
      'Preserve ONE source interval per curated highlight in original order. You may adjust each start/end by up to 15 seconds beyond the curator\'s original interval when the FULL transcript shows a needed setup or complete ending. Do not lose a highlight, pick unrelated moments or turn the reel into a single continuous scene.',
      'Choose a whole-thought beginning and ending for EACH interval. Never end with "And", "In the", a dangling clause, or an incomplete question. Do not claim quotes not literally spoken. Give a 2+ word timed landing quote near each end, then stop (max 4 seconds after landing).',
      'Read the ENTIRE authorized timed transcript, including the earlier question and the later answer for each moment. Judge the whole exchange, not its last word or punctuation. Keep source-referenced absolute milliseconds and submit one submit_highlights_finish tool call.',
    ].join('\\n\\n') },
    { role: 'user', content: JSON.stringify({
      outline, targetSeconds: ctx.config.targetLengthS,
      originalSeconds: seconds(footage), curatedHighlights: footage,
      perHighlightIntent: footage.map((selection, index) => ({
        index,
        sourceRangeMs: [selection.startMs, selection.endMs],
        intendedMoment: selection.beat,
        whyItWasSelected: selection.reason,
        editorialCriterion: outline.highlightCriteria,
        desiredEnding: 'The complete, source-supported resolution or landing of THIS moment, not a forced story-wide payoff',
      })),
      entireAuthorizedTranscript: fullFinisherTranscript(words, source.rangeMs),
      wordTupleFormat: '[sourceStartMs,sourceEndMs,spokenWord]',
      instruction: 'Return the same number of highlights as supplied, but each shorter and independently complete. Choose separate verified spoken landing quotes. Prioritize conversational meaning and a clean ending for all moments.',
    }) },
  ]
  let reason='highlights_finisher_no_usable_decision'
  for(let attempt=0;attempt<3;attempt++) {
    if (budget.state() === 'hard') throw new Error('highlights_finisher_budget_exhausted')
    const response=await lunaChat({messages,tools:[highlightsSubmission],toolChoice:'required'})
    budget.steps++
    budget.addLuna(response.usage)
    messages.push(response.message)
    const call=response.message.tool_calls?.find(c=>c.function.name===highlightsSubmission.name)
    try {
      if(!call) throw new Error('highlights_finisher_missing_submit_tool')
      const proposal=JSON.parse(call.function.arguments) as unknown
      const decision=verifyHighlightsFinish(proposal,footage,words,source.rangeMs,ctx.config.targetLengthS)
      await logAiProducerStep({
        runId:ctx.runId, stepIndex:budget.steps, phase:'plan', kind:'validate',
        tool:'highlights_finisher_accepted',
        argsSummary:JSON.stringify({beforeSeconds:seconds(footage),afterSeconds:seconds(decision.selections),
          moments:decision.moments.map(m=>({range:[m.selection.startMs,m.selection.endMs],
            landing:[m.landing.startMs,m.landing.endMs]}))}).slice(0,3000),
        resultSummary:'verified independent source-grounded endings for curated highlights',
      })
      return decision
    } catch(error) {
      reason=String((error as Error).message).slice(0,200)
      await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'plan',kind:'validate',
        tool:'highlights_finisher_rejected',error:reason,resultSummary:reason})
      if(call) messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({
        ok:false,error:reason,
        instruction:'Keep every original highlight once. Select within each original interval, verify the exact spoken landing quotes, close every moment cleanly, and compress to the requested duration. Resubmit.',
      })})
    }
  }
  throw new Error(reason)
}

export async function runStoryFinisher(
  ctx: ToolCtx, budget: Budget,
  outline: EditorialOutline,
  footage: EditorialSelection[],
  mode: 'normal' | 'rescue' = 'normal',
  preferredEdits?: FootagePreferredEdit[],
): Promise<StoryFinisherDecision> {
  const words = ctx.cache.words ?? []
  const source = ctx.sources[0]
  if (!source?.rangeMs || !words.length || !footage.length) throw new Error('finisher_source_unavailable')
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      ...(mode === 'rescue' ? ['RECOVERY PASS: Earlier proposals were rejected. You MUST compress from the original curated Footage into a valid concise story. The full transcript is for understanding, not expanded source eligibility. Prefer several 5–20 second intervals wholly inside the candidate passages. Omit candidates and filler freely. Never span an excluded gap. Submit under the hard maximum runtime.'] : []),
      'You are STORY FINISHER, a PRECISION COMPRESSION EDITOR between Footage and Dialogue. The Story creative brief identifies the intended narrative, not facts. Verify the real payoff in the recording. Footage selections are CANDIDATES, not paragraphs you must keep. Shorten each to the few essential spoken seconds, or OMIT it completely. Retain the minimum truthful setup, development and payoff for the requested runtime.',
      'Footage has supplied TWO kinds of ranges: broad source candidates (authorized source material), and optional preferredEdits that identify the short section, purpose, and semantic ending. Treat preferredEdits as your first-pass PAPER EDIT. Do NOT simply preserve the broader source candidates. Verify each preferred ending against the FULL conversation. You may tighten, shift within authorized footage, split, or OMIT a suggested passage when doing so creates a more coherent cut. The editing target is the final selected seconds, not the combined candidate duration.',
      'Read the ENTIRE timed transcript for SEMANTIC UNDERSTANDING, but select footage ONLY inside the authorized candidate intervals (plus at most 15 seconds of nearby context when truly necessary). The full transcript is NOT an instruction to preserve surrounding sentences. Never propose one continuous interval across an omitted source gap. If relevant moments are separated by a gap, return separate intervals. You may omit any unneeded candidate.',
      'For EACH kept passage, find the first necessary spoken word and the LAST word that completes the relevant thought. Stop BEFORE the speaker starts a new tangent, even if that tangent appears in the same ASR paragraph. Do not continue to a later full stop merely to satisfy punctuation. Likewise, do not start halfway into an essential phrase. A spoken payoff must be a precise 2+ word quote in the LAST kept passage; stop within 8 seconds after it. Target the specified seconds by deleting redundant ideas, never by clipping blindly at a timer or padding.',
      'Submit original absolute millisecond boundaries aligned to the FIRST and LAST required source words. Output 5–20 second spans when those suffice, but a meaningful 1–2 second reaction is also allowed. Long spans only when every included sentence is essential. Respect source order and chronology. Verify semantic completeness of ALL joins, not only the final ending. Roughly 90 seconds is the creative target; a good cut 1–3 seconds beyond the nominal maximum is preferable to a broken thought.',
    ].join('\n\n') },
    { role: 'user', content: JSON.stringify({
      outline, targetSeconds: ctx.config.targetLengthS,
      storyIntent: {
        intendedPayoff: outline.intendedPayoff,
        essentialSetup: outline.essentialSetup,
        excludeAsides: outline.excludeAsides,
        endingRule: outline.endingRule,
      },
      originalSeconds: seconds(footage), curatedSelections: footage,
      ...(preferredEdits?.length ? { preferredEdits, preferredTotalSeconds: preferredEdits.reduce((sum, item) => sum + (item.preferredEndMs - item.preferredStartMs), 0) / 1000 } : {}),
      entireAuthorizedTranscript: fullFinisherTranscript(words, source.rangeMs),
      wordTupleFormat: '[sourceStartMs,sourceEndMs,spokenWord]',
      instruction: 'Begin with preferredEdits as suggested cuts, not mandatory boundaries. Check their intendedPoint and endingCue for each passage against the full source, and retain only the strongest relevant spoken words. Return only the precise necessary source-word intervals. Omit digressions, repeated explanations and candidate passages that do not earn their seconds. Do not treat full-transcript context as material to keep. For each kept interval set its end to the last word of the relevant complete thought, BEFORE the next sentence or tangent begins; never keep a trailing sentence fragment. Verify source-spoken payoff and target length.',
    }) },
  ]
  let reason = 'finisher_no_usable_decision'
  for (let attempt = 0; attempt < (mode === 'rescue' ? 2 : 3); attempt++) {
    if (budget.state() === 'hard') throw new Error('finisher_budget_exhausted')
    const response = await lunaChat({ messages, tools: [submission], toolChoice: 'required' })
    budget.steps++
    budget.addLuna(response.usage)
    messages.push(response.message)
    const call = response.message.tool_calls?.find(c => c.function.name === submission.name)
    try {
      if (!call) throw new Error('finisher_missing_submit_tool')
      const proposal = JSON.parse(call.function.arguments) as unknown
      const decision = verifyStoryFinish(proposal, footage, words, source.rangeMs, ctx.config.targetLengthS)
      await logAiProducerStep({
        runId: ctx.runId, stepIndex: budget.steps, phase: 'plan', kind: 'validate',
        tool: 'story_finisher_accepted',
        argsSummary: JSON.stringify({
          beforeSeconds: seconds(footage), afterSeconds: seconds(decision.selections),
          payoff: [decision.payoff.startMs, decision.payoff.endMs],
          kept: decision.selections.map(s => [s.startMs,s.endMs]),
        }).slice(0, 3000),
        resultSummary: 'verified source-grounded payoff and trimmed story',
      })
      return decision
    } catch (error) {
      reason = String((error as Error).message).slice(0, 200)
      const proposal = call ? (() => { try { return JSON.parse(call.function.arguments) as unknown } catch { return null } })() : null
      const repairHint = finisherRepairHint((proposal as { selections?: unknown } | null)?.selections, footage, source.rangeMs, ctx.config.targetLengthS)
      await logAiProducerStep({
        runId: ctx.runId, stepIndex: budget.steps, phase: 'plan', kind: 'validate',
        tool: 'story_finisher_rejected', error: reason,
        argsSummary: JSON.stringify({ proposed: Array.isArray((proposal as { selections?: unknown } | null)?.selections) ?
          ((proposal as { selections: EditorialSelection[] }).selections).map(s => [s.startMs,s.endMs]).slice(0,24) : [], repairHint }).slice(0,3000),
        resultSummary: reason,
      })
      if (call) messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({
        ok: false, error: reason, repairHint,
        instruction: repairHint.instruction,
      }) })
    }
  }
  throw new Error(reason)
}

/**
 * Short-Story boundary polish only. Footage already chose the movie; this pass
 * may remove a few extra words at each edge, never rescout or rebuild a story.
 * No entire-source transcript, separate preferred-edit arrays, or payoff search.
 */
const boundarySubmission: ToolSchema = {
  name: 'submit_story_boundary_polish',
  description: 'Polish only the existing first/last spoken words of each Story cut.',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      selections: {
        type: 'array', minItems: 1, maxItems: 24,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            startMs: { type: 'integer', minimum: 0 },
            endMs: { type: 'integer', minimum: 0 },
            beat: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['startMs','endMs','beat','reason'],
        },
      },
    },
    required: ['selections'],
  },
}

export function verifyStoryBoundaryPolish(
  raw: unknown, original: EditorialSelection[], words: ClipWord[], bounds: [number, number],
): EditorialSelection[] {
  if (!Array.isArray(raw) || raw.length !== original.length)
    throw new Error('boundary_polish_must_keep_every_selected_passage')
  const polished: EditorialSelection[] = raw.map((entry, i) => {
    const prior = original[i]!
    if (!entry || typeof entry !== 'object') throw new Error('boundary_polish_invalid_entry')
    const r = entry as Partial<EditorialSelection>
    if (!Number.isInteger(r.startMs) || !Number.isInteger(r.endMs) ||
      typeof r.startMs !== 'number' || typeof r.endMs !== 'number' ||
      r.startMs < prior.startMs || r.endMs > prior.endMs ||
      r.startMs > prior.startMs + 3_000 || r.endMs < prior.endMs - 3_000 ||
      r.endMs <= r.startMs || r.startMs < bounds[0] || r.endMs > bounds[1]) {
      throw new Error('boundary_polish_outside_original_or_3s_edge_limit')
    }
    // Only shift to a boundary that does not slice through an ASR word.
    if (wordAtUnsafeBoundary(r.startMs, words) || wordAtUnsafeBoundary(r.endMs, words))
      throw new Error('boundary_polish_edge_inside_word')
    if (!words.some(w => w.e * 1000 > r.startMs! && w.s * 1000 < r.endMs!))
      throw new Error('boundary_polish_no_spoken_words')
    return { ...prior, startMs: r.startMs, endMs: r.endMs }
  })
  for (let i = 1; i < polished.length; i++)
    if (polished[i]!.startMs < polished[i-1]!.endMs)
      throw new Error('boundary_polish_overlapping_ranges')
  return polished
}

export async function runStoryBoundaryFinisher(
  ctx: ToolCtx, budget: Budget, outline: EditorialOutline,
  footage: EditorialSelection[],
): Promise<EditorialSelection[]> {
  const source = ctx.sources[0]
  const words = ctx.cache.words ?? []
  if (!source?.rangeMs || !footage.length || !words.length) return footage
  const contextMs = 10_000
  const excerpts = footage.map((selection, index) => ({
    index, selection,
    transcript: fullFinisherTranscript(words, [
      Math.max(source.rangeMs![0], selection.startMs - contextMs),
      Math.min(source.rangeMs![1], selection.endMs + contextMs),
    ]),
  }))
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      'You are a BOUNDARY POLISHER, not an editor or story selector. The Footage Agent has already made the final short edit.',
      'Keep EXACTLY the same cuts in the same order. Do not add, drop, move to another source moment, or change the story. Only remove extra words at the BEGINNING or END of each existing passage.',
      'Each start may move FORWARD at most 3000ms; each end may move BACKWARD at most 3000ms. No expansions. If the present edge is already natural, return it unchanged.',
      'Use the nearby transcript for conversational context and identify the last spoken word that completes the thought. Avoid dangling fragments or beginnings of new thoughts. Small authentic reactions are allowed.',
      'Return the existing beat and reason for every interval. Use the original source millisecond timestamps and word-safe boundaries. Never target an exact duration or trim the payoff just to save seconds.',
    ].join('\n\n') },
    { role: 'user', content: JSON.stringify({
      story: { logline: outline.logline, essentialSetup: outline.essentialSetup,
        intendedPayoff: outline.intendedPayoff, endingRule: outline.endingRule },
      selectedPassages: excerpts,
      tupleFormat: '[sourceStartMs,sourceEndMs,word]',
      instruction: 'Return one selection per input, same order. Trim only truly unnecessary edge words; keep everything else unchanged.',
    }) },
  ]
  for (let attempt = 0; attempt < 2; attempt++) {
    if (budget.state() === 'hard') break
    const response = await lunaChat({ messages, tools: [boundarySubmission], toolChoice: 'required' })
    budget.steps++
    budget.addLuna(response.usage)
    messages.push(response.message)
    const call = response.message.tool_calls?.find(c => c.function.name === boundarySubmission.name)
    try {
      if (!call) throw new Error('boundary_polish_missing_submission')
      const candidate = JSON.parse(call.function.arguments) as { selections?: unknown }
      const result = verifyStoryBoundaryPolish(candidate.selections, footage, words, source.rangeMs)
      await logAiProducerStep({
        runId: ctx.runId, stepIndex: budget.steps, phase: 'plan',
        tool: 'story_boundary_polish_accepted', kind: 'validate',
        argsSummary: JSON.stringify({ before: footage.map(x=>[x.startMs,x.endMs]),
          after: result.map(x=>[x.startMs,x.endMs]) }).slice(0,3000),
        resultSummary: 'polished only original passage edges',
      })
      return result
    } catch (error) {
      const reason = String((error as Error).message).slice(0,200)
      await logAiProducerStep({
        runId: ctx.runId, stepIndex: budget.steps, phase: 'plan',
        tool: 'story_boundary_polish_rejected', kind: 'validate',
        error: reason, resultSummary: reason,
      })
      if (call) messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({
        ok:false,error:reason,
        instruction:'Do not rethink the edit. Keep one passage per original, only tighten each start/end by up to 3 seconds, and preserve valid untouched edges.',
      }) })
    }
  }
  // A failed polish must NEVER erase the Footage cut.
  return footage
}

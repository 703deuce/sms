import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import type { Budget } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import { logAiProducerStep } from '@/lib/ai-producer-agent/log'
import { checkEditorialSelections, snapEditorialSelections, type EditorialSelection, type EditorialOutline, type FootagePreferredEdit } from '@/lib/ai-producer-agent/specialists'
import type { ToolSchema } from '@/lib/ai-producer-agent/tools/schemas'
import { WORD_GUARD_MS, wordAtUnsafeBoundary } from '@/lib/ai-producer-agent/validate'

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
  options: { youtubeLongForm?: boolean } = {},
): Promise<StoryFinisherDecision> {
  // The existing Finisher is a short-form compression editor. An explicitly
  // opted-in YouTube story keeps every curated passage and only polishes word
  // boundaries; no 90-second instructions, duration gate or invented payoff.
  if (options.youtubeLongForm) {
    if (!footage.length) throw new Error('youtube_finisher_no_passages')
    const polished = footage.some((cut) => (ctx.cache.words ?? []).some((word) =>
      word.e * 1000 > cut.startMs && word.s * 1000 < cut.endMs))
      ? await runStoryBoundaryFinisher(ctx, budget, outline, footage)
      : footage
    const last = polished[polished.length - 1]!
    const spoken = (ctx.cache.words ?? []).filter((word) =>
      word.e * 1000 > last.startMs && word.s * 1000 < last.endMs)
    const payoffWords = spoken.slice(-8)
    const quote = payoffWords.map((word) => word.w).join(' ')
    await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'plan',
      kind:'validate',tool:'youtube_long_form_finisher',
      resultSummary:`retained ${polished.length} curated passages without a duration target`})
    return { selections: polished, payoff: {
      startMs: payoffWords.length ? Math.round(payoffWords[0]!.s * 1000) : last.startMs,
      endMs: payoffWords.length ? Math.round(payoffWords[payoffWords.length - 1]!.e * 1000) : last.endMs,
      quote,
    }, editorialReason: 'YouTube long-form: preserved source-grounded story without short-form compression' }
  }
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
 * The language model chooses WORD IDs, never milliseconds. Resolve each edge
 * independently, using source ASR timestamps and the shared word guard.
 * Bad/unsnappable edges preserve the source edit instead of erasing good ones.
 */
export type BoundaryWordDecision = {
  index: number
  firstWordId: number
  lastWordId: number
}
export type BoundaryPolishResult = {
  selections: EditorialSelection[]
  diagnostics: Array<{index: number; start: string; end: string}>
}

const boundaryWordSubmission: ToolSchema = {
  name: 'submit_story_word_boundaries',
  description: 'Choose first and last transcript word IDs to keep in each already-selected passage; do not submit timestamps.',
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      passages: {
        type: 'array', minItems: 1, maxItems: 24,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            index: { type: 'integer', minimum: 0 },
            firstWordId: { type: 'integer', minimum: 0 },
            lastWordId: { type: 'integer', minimum: 0 },
          },
          required: ['index','firstWordId','lastWordId'],
        },
      },
    },
    required: ['passages'],
  },
}


/** A second, independent semantic judgement of the proposed *edge words*.
 * This is still the same Finisher: never reselects a scene or changes beats. */
type BoundaryReview = {
  index: number
  openingComplete: boolean
  endingComplete: boolean
  firstWordId: number
  lastWordId: number
  explanation: string
}
const boundaryReviewSubmission: ToolSchema = {
  name: 'submit_story_boundary_review',
  description: 'Check whether each proposed first/last word forms a complete spoken thought; correct only incomplete edges.',
  parameters: {
    type:'object',additionalProperties:false,
    properties:{
      reviews:{type:'array',minItems:1,maxItems:24,items:{
        type:'object',additionalProperties:false,
        properties:{
          index:{type:'integer',minimum:0},
          openingComplete:{type:'boolean'},
          endingComplete:{type:'boolean'},
          firstWordId:{type:'integer',minimum:0},
          lastWordId:{type:'integer',minimum:0},
          explanation:{type:'string'},
        },
        required:['index','openingComplete','endingComplete','firstWordId','lastWordId','explanation'],
      }},
    },
    required:['reviews'],
  },
}

function spokenPassages(selections: EditorialSelection[], words: ClipWord[]) {
  return selections.map((s,index)=>({
    index, startMs:s.startMs,endMs:s.endMs,
    spokenWords:words.flatMap((w,id)=>Number.isFinite(w.s)&&Number.isFinite(w.e)&&
      w.e*1000>s.startMs&&w.s*1000<s.endMs
      ? [{id,text:w.w}]:[]),
  }))
}

/** Accept valid reviewed edges individually. When the reviewer identifies an
 * incomplete thought, test its proposed new word ID in the same deterministic
 * scoped resolver. An uncorrected/invalid edge is explicitly marked unresolved,
 * never silently promoted as an editorially complete success. */
export function applyStoryBoundaryReview(
  raw: unknown, initial: EditorialSelection[], candidate: EditorialSelection[],
  words: ClipWord[], bounds: [number,number],
): {selections:EditorialSelection[];unresolved:Array<{index:number;edge:'start'|'end';reason:string}>} {
  const reviews=Array.isArray(raw)?raw:[]
  const revised=candidate.map(x=>({...x}))
  const unresolved:Array<{index:number;edge:'start'|'end';reason:string}>=[]
  for(let index=0;index<candidate.length;index++){
    const options=reviews.filter(r=>r && typeof r==='object'&&(r as BoundaryReview).index===index) as BoundaryReview[]
    const review=options.length===1?options[0]:undefined
    if(!review || typeof review.openingComplete!=='boolean'||typeof review.endingComplete!=='boolean'){
      unresolved.push({index,edge:'start',reason:'no_semantic_review'})
      unresolved.push({index,edge:'end',reason:'no_semantic_review'})
      continue
    }
    if(review.openingComplete && review.endingComplete)continue
    const nearby=resolveStoryWordBoundaries([{
      index,firstWordId:review.firstWordId,lastWordId:review.lastWordId,
    }],initial,words,bounds).selections[index]!
    if(!review.openingComplete){
      if(nearby.startMs!==candidate[index]!.startMs && nearby.startMs!==initial[index]!.startMs){
        revised[index]!.startMs=nearby.startMs
      }else{
        unresolved.push({index,edge:'start',reason:'incomplete_opening_no_new_safe_word'})
      }
    }
    if(!review.endingComplete){
      if(nearby.endMs!==candidate[index]!.endMs && nearby.endMs!==initial[index]!.endMs){
        revised[index]!.endMs=nearby.endMs
      }else{
        unresolved.push({index,edge:'end',reason:'incomplete_ending_no_new_safe_word'})
      }
    }
    if(revised[index]!.endMs-revised[index]!.startMs<400){
      revised[index]={...candidate[index]!}
      unresolved.push({index,edge:'start',reason:'corrected_passage_would_collapse'})
      unresolved.push({index,edge:'end',reason:'corrected_passage_would_collapse'})
    }
  }
  return {selections:revised,unresolved}
}

const EDGE_SEARCH_MS = 1500
const CONTEXT_SENTENCES = 2
const SENTENCE_PAUSE_MS = 1400

/** Surface the ENTIRE Footage passage plus the previous/next two sentences.
 * Punctuation is the primary sentence boundary. On ASR without punctuation,
 * long natural speech pauses delimit nearby thought groups. No seconds cap:
 * slow speech can require tens of seconds to finish a sentence. */
export function boundaryWordContext(
  words: ClipWord[], selections: EditorialSelection[], bounds: [number, number],
) {
  const timed = words.flatMap((w,id) => Number.isFinite(w.s) &&
    Number.isFinite(w.e) && w.e > w.s
    ? [{ id,startMs:Math.round(w.s*1000),endMs:Math.round(w.e*1000),text:w.w }]
    : []).filter(w => w.endMs > bounds[0] && w.startMs < bounds[1])
    .sort((a,b)=>a.startMs-b.startMs || a.id-b.id)
  // A pause is supporting evidence when ASR has no punctuation, not an
  // artificial maximum sentence length or an instruction to split a thought.
  const endOfSentence = (i:number) => {
    const w=timed[i]!
    return /[.!?][”"'’)]*$/.test(w.text.trim()) ||
      Boolean(timed[i+1] && timed[i+1]!.startMs - w.endMs >= SENTENCE_PAUSE_MS)
  }
  const sentenceEndIndices:number[]=[]
  for(let i=0;i<timed.length;i++)if(endOfSentence(i))sentenceEndIndices.push(i)
  if(timed.length && sentenceEndIndices[sentenceEndIndices.length-1]!==timed.length-1)
    sentenceEndIndices.push(timed.length-1)
  return selections.map((selection,index)=>{
    // All overlapping words in Footage's selection are always included.
    const first=timed.findIndex(w=>w.endMs>selection.startMs)
    let last=-1
    for(let i=timed.length-1;i>=0;i--)if(timed[i]!.startMs<selection.endMs){last=i;break}
    if(first<0||last<first)
      return {index,currentStartMs:selection.startMs,currentEndMs:selection.endMs,
        beat:selection.beat,purpose:selection.reason,words:[] as Array<{
          id:number;startMs:number;endMs:number;text:string;currentlyKept:boolean
        }>}
    // Resolve context by COMPLETE sentence boundaries, including the entire
    // original selection even when it spans many sentences.
    const firstSentence=sentenceEndIndices.findIndex(e=>e>=first)
    const lastSentence=sentenceEndIndices.findIndex(e=>e>=last)
    let contextFirstSentence=Math.max(0,firstSentence-CONTEXT_SENTENCES)
    let contextLastSentence=Math.min(sentenceEndIndices.length-1,lastSentence+CONTEXT_SENTENCES)
    // A distant recording event is not neighboring sentence context. Never
    // cross a conversational break (e.g. a word 13 minutes later), even if
    // missing punctuation makes it the next ASR sentence.
    let left=contextFirstSentence===0?0:sentenceEndIndices[contextFirstSentence-1]!+1
    let right=sentenceEndIndices[contextLastSentence]!
    for(let i=first;i>left;i--){
      if(timed[i]!.startMs-timed[i-1]!.endMs>30000){left=i;break}
    }
    for(let i=last;i<right;i++){
      if(timed[i+1]!.startMs-timed[i]!.endMs>30000){right=i;break}
    }
    return {
      index,currentStartMs:selection.startMs,currentEndMs:selection.endMs,
      beat:selection.beat,purpose:selection.reason,
      words:timed.slice(left,right+1).map(w=>({
        ...w,currentlyKept:w.endMs>selection.startMs&&w.startMs<selection.endMs,
      })),
    }
  })
}

/** Find a legal edge nearest the WORD boundary, never near an LLM timestamp.
 * A dense overlapping word cluster may have no legal seam; in that case the
 * individual edge stays unchanged. No broad rescouting or speculative cuts. */
function safeBoundaryAfterWord(
  word: ClipWord, kind: 'start' | 'end', words: ClipWord[],
  min: number, max: number,
): number | null {
  const anchor = Math.round((kind === 'start' ? word.s : word.e) * 1000)
  const target = anchor + (kind === 'start' ? -WORD_GUARD_MS : WORD_GUARD_MS)
  const lo = Math.max(min, target - EDGE_SEARCH_MS)
  const hi = Math.min(max, target + EDGE_SEARCH_MS)
  if (hi < lo) return null
  const possible = new Set<number>([lo,hi,Math.max(lo,Math.min(hi,target))])
  for (const w of words) {
    if (!Number.isFinite(w.s) || !Number.isFinite(w.e) || w.e <= w.s) continue
    const start = Math.round(w.s * 1000), end = Math.round(w.e * 1000)
    if (start - WORD_GUARD_MS >= lo && start - WORD_GUARD_MS <= hi)
      possible.add(start - WORD_GUARD_MS)
    if (end + WORD_GUARD_MS >= lo && end + WORD_GUARD_MS <= hi)
      possible.add(end + WORD_GUARD_MS)
  }
  // Start must not remove the selected first word; end must include last word.
  return [...possible].filter(t => t >= min && t <= max &&
    (kind === 'start' ? t <= anchor - WORD_GUARD_MS : t >= anchor + WORD_GUARD_MS) &&
    !wordAtUnsafeBoundary(t, words))
    .sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0] ?? null
}

export function resolveStoryWordBoundaries(
  raw: unknown, original: EditorialSelection[], words: ClipWord[], bounds: [number, number],
): BoundaryPolishResult {
  const proposals = Array.isArray(raw) ? raw : []
  const context = boundaryWordContext(words,original,bounds)
  const selections: EditorialSelection[] = []
  const diagnostics: BoundaryPolishResult['diagnostics'] = []
  for(let index=0;index<original.length;index++){
    const prior=original[index]!
    const options=proposals.filter(v=>v && typeof v==='object' &&
      (v as BoundaryWordDecision).index===index) as BoundaryWordDecision[]
    const proposal=options.length===1?options[0]:undefined
    let start=prior.startMs,end=prior.endMs
    let startStatus='unchanged',endStatus='unchanged'
    if(!proposal){
      selections.push(prior)
      diagnostics.push({index,start:'missing_or_duplicate_proposal',end:'missing_or_duplicate_proposal'})
      continue
    }
    const eligible=new Set(context[index]!.words.map(w=>w.id))
    const first=Number.isInteger(proposal.firstWordId)&&eligible.has(proposal.firstWordId)
      ? words[proposal.firstWordId]:undefined
    const last=Number.isInteger(proposal.lastWordId)&&eligible.has(proposal.lastWordId)
      ? words[proposal.lastWordId]:undefined
    // The model is only allowed to extend into the surrounding sentence
    // context; trims must stay inside this original source passage.
    const leftLimit=Math.max(bounds[0],index?original[index-1]!.endMs:bounds[0],
      (context[index]!.words[0]?.startMs??prior.startMs)-WORD_GUARD_MS)
    const rightLimit=Math.min(bounds[1],
      index+1<original.length?original[index+1]!.startMs:bounds[1],
      (context[index]!.words.at(-1)?.endMs??prior.endMs)+WORD_GUARD_MS)
    if(first && Number.isFinite(first.s)&&Number.isFinite(first.e) && first.e>first.s){
      const wordStart=Math.round(first.s*1000)
      if(wordStart>=leftLimit && wordStart<prior.endMs){
        const resolved=safeBoundaryAfterWord(first,'start',words,leftLimit,
          Math.min(prior.endMs-400,rightLimit))
        if(resolved!==null){start=resolved;startStatus='resolved_word_id'}
        else startStatus='no_safe_word_edge'
      }else startStatus='first_word_outside_passage_context'
    }else startStatus='invalid_or_unavailable_first_word_id'
    if(last && Number.isFinite(last.s)&&Number.isFinite(last.e)&&last.e>last.s){
      const wordEnd=Math.round(last.e*1000)
      if(wordEnd<=rightLimit && wordEnd>prior.startMs){
        const resolved=safeBoundaryAfterWord(last,'end',words,
          Math.max(leftLimit,prior.startMs+400),rightLimit)
        if(resolved!==null){end=resolved;endStatus='resolved_word_id'}
        else endStatus='no_safe_word_edge'
      }else endStatus='last_word_outside_passage_context'
    }else endStatus='invalid_or_unavailable_last_word_id'
    // A model returning reversed words must not turn the passage into a new
    // story. Independently keep whichever edge remains playable.
    if(end-start<400){
      if(end-prior.startMs>=400){start=prior.startMs;startStatus='kept_original_to_avoid_collapse'}
      else if(prior.endMs-start>=400){end=prior.endMs;endStatus='kept_original_to_avoid_collapse'}
      else{start=prior.startMs;end=prior.endMs;startStatus='kept_original';endStatus='kept_original'}
    }
    selections.push({...prior,startMs:start,endMs:end})
    diagnostics.push({index,start:startStatus,end:endStatus})
  }
  return {selections,diagnostics}
}

export async function runStoryBoundaryFinisher(
  ctx: ToolCtx, budget: Budget, outline: EditorialOutline,
  footage: EditorialSelection[],
): Promise<EditorialSelection[]> {
  const source = ctx.sources[0]
  const words = ctx.cache.words ?? []
  if (!source?.rangeMs || !footage.length || !words.length) return footage
  const context = boundaryWordContext(words,footage,source.rangeMs)
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      'You are a spoken-word boundary polisher, NOT a video editor. Footage already selected the story and every passage.',
      'For each existing passage, identify the FIRST and LAST transcript words that should remain. Return ONLY their integer word IDs, never timestamps.',
      'Do not select new source moments, omit passages, change their order, or compress the story. Remove only an extra few words at the edges. If the current start/end is already a complete thought, choose its existing first/last kept word.',
      'You may recover the relevant earlier sentence beginning for a late start, or the actual conclusion for an early ending. Context contains two complete sentences before and after each original cut; speech may be slow, so there is no two- or three-second limit.',
      'Use the full transcript of each proposed passage and its neighboring sentences. The code converts your chosen word IDs into legal boundaries. Do not calculate milliseconds, aim at a runtime, or reselect scenes.',
    ].join('\n\n') },
    { role: 'user', content: JSON.stringify({
      story: { logline:outline.logline, essentialSetup:outline.essentialSetup,
        intendedPayoff:outline.intendedPayoff, endingRule:outline.endingRule },
      passages:context,
      instruction:'For every existing passage, choose precisely its first and last words needed for the planned story. Consider up to two full sentences before and after, regardless of speech speed. Return index, firstWordId, lastWordId; every ID must appear in that passage words array. Do not add/remove passages.',
    }) },
  ]
  if (budget.state() === 'hard') return footage
  const response = await lunaChat({ messages, tools:[boundaryWordSubmission], toolChoice:'required' })
  budget.steps++
  budget.addLuna(response.usage)
  const call = response.message.tool_calls?.find(c=>c.function.name===boundaryWordSubmission.name)
  if(!call){
    await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'plan',kind:'validate',
      tool:'story_word_boundary_unavailable',resultSummary:'No word IDs; original Footage edges preserved'})
    return footage
  }
  let initial:BoundaryPolishResult
  try{
    const parsed=JSON.parse(call.function.arguments) as {passages?:unknown}
    initial=resolveStoryWordBoundaries(parsed.passages,footage,words,source.rangeMs)
  }catch(error){
    await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'plan',kind:'validate',
      tool:'story_word_boundary_unavailable',error:String((error as Error).message).slice(0,200),
      resultSummary:'Invalid word decision; original edges preserved'})
    return footage
  }
  // The first model response only establishes valid PHYSICAL cut points.
  // Another semantic look at the ACTUAL retained spoken words catches fluent
  // timestamp choices that still finish on "Casey, he's like," or "church,".
  let current=initial.selections
  const unresolved=new Set<string>()
  for(let pass=0;pass<2 && budget.state()!=='hard';pass++){
    const reviewMessages:LunaMessage[]=[
      {role:'system',content:[
        'You are checking only the START and END of an already-selected spoken passage. You do NOT edit the movie.',
        'Independently judge whether each first and last spoken phrase is a NATURALLY COMPLETE thought, using its nearby conversational context and the Story objective.',
        'An ending such as "My dad took me to church," or "Casey, he is like," is NOT complete: the speaker is about to explain what happened or quote someone. An opening mid-answer with missing setup is also incomplete.',
        'Do not mistake a timestamp-safe word for a semantically complete ending. An unfinished question, dangling setup or introduction to a quote must be corrected.',
        'For each passage, set openingComplete and endingComplete. If incomplete, return the FIRST or LAST word ID that actually completes the SAME intended thought. If it is already complete, return the first/last retained word ID unchanged.',
        'Only choose IDs supplied in that passage context; do not change story beats, drop passages, join gaps, or introduce another scene. A cut may be outside target seconds if the thought needs it.',
      ].join('\n\n')},
      {role:'user',content:JSON.stringify({
        story:{logline:outline.logline,intendedPayoff:outline.intendedPayoff,
          essentialSetup:outline.essentialSetup,endingRule:outline.endingRule},
        passages:context,
        actualProposedCut:spokenPassages(current,words),
        instruction:'Review the actual words that would be heard after the proposed cuts. Flag dangling openings and endings; give grounded corrected word IDs when needed. Do not simply approve mechanically legal endpoints.',
        ...(pass?{previousUnresolved:[...unresolved]}:{}),
      })},
    ]
    let reviewed:Awaited<ReturnType<typeof lunaChat>>
    try{
      reviewed=await lunaChat({messages:reviewMessages,tools:[boundaryReviewSubmission],toolChoice:'required'})
      budget.steps++
      budget.addLuna(reviewed.usage)
    }catch(error){
      await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'plan',kind:'validate',
        tool:'story_word_boundary_review_failed',
        error:String((error as Error).message).slice(0,200),
        resultSummary:'Semantic review unavailable; preserve existing word-aligned draft'})
      unresolved.add('semantic_review_unavailable')
      break
    }
    const reviewCall=reviewed.message.tool_calls?.find(c=>c.function.name===boundaryReviewSubmission.name)
    if(!reviewCall){
      await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'plan',kind:'validate',
        tool:'story_word_boundary_review_missing',resultSummary:'Semantic acceptance not verified; keep current sourced cut'})
      unresolved.add('semantic_review_missing')
      break
    }
    let reviewInput:unknown
    try{reviewInput=(JSON.parse(reviewCall.function.arguments) as {reviews?:unknown}).reviews}
    catch{reviewInput=[]}
    const decisions=Array.isArray(reviewInput)?reviewInput:[]
    const accepted=applyStoryBoundaryReview(decisions,footage,current,words,source.rangeMs)
    current=accepted.selections
    unresolved.clear()
    for(const issue of accepted.unresolved)unresolved.add(issue.index+':'+issue.edge+':'+issue.reason)
    for(let i=0;i<footage.length;i++){
      const r=decisions.find(d=>d&&typeof d==='object'&&(d as BoundaryReview).index===i) as BoundaryReview|undefined
      if(!r || !r.openingComplete)unresolved.add(i+':start:needs_semantic_recheck')
      if(!r || !r.endingComplete)unresolved.add(i+':end:needs_semantic_recheck')
    }
    await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'plan',kind:'validate',
      tool:'story_word_boundary_semantic_review',
      argsSummary:JSON.stringify({pass,unresolved:[...unresolved],
        before:initial.selections.map(x=>[x.startMs,x.endMs]),
        after:current.map(x=>[x.startMs,x.endMs])}).slice(0,4000),
      resultSummary:unresolved.size?'Some thought boundaries need correction':'All reviewed boundaries semantically complete'})
    if(!unresolved.size)break
  }
  await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'plan',kind:'validate',
    tool:unresolved.size?'story_word_boundary_incomplete':'story_word_boundary_accepted',
    argsSummary:JSON.stringify({unresolved:[...unresolved],
      before:footage.map(s=>[s.startMs,s.endMs]),
      after:current.map(s=>[s.startMs,s.endMs]),
      physical:initial.diagnostics}).slice(0,4000),
    resultSummary:unresolved.size?'Unresolved thought edges explicitly logged; editable cut preserved':
      'Word-aligned boundaries passed semantic completeness review'})
  return current

}

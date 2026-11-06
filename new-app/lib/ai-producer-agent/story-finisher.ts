import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import type { Budget } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import { logAiProducerStep } from '@/lib/ai-producer-agent/log'
import { checkEditorialSelections, snapEditorialSelections, type EditorialSelection } from '@/lib/ai-producer-agent/specialists'
import type { ToolSchema } from '@/lib/ai-producer-agent/tools/schemas'

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

function transcriptFor(words: ClipWord[], selections: EditorialSelection[]) {
  return selections.map((s) => ({
    rangeMs: [s.startMs, s.endMs],
    // Include 3s of context at both ends, without allowing the model to
    // select intervals outside the curator's evidence.
    wordEvidence: words.filter(w => w.e * 1000 > s.startMs - 3000 &&
      w.s * 1000 < s.endMs + 3000)
      .slice(0, 950).map(w => ({
        startMs: Math.round(w.s * 1000), endMs: Math.round(w.e * 1000), text: w.w,
      })),
  }))
}

/** A legal millisecond is not an editorial sentence boundary.
 * Check EVERY chosen join, not only the final passage. Deepgram can assign
 * commas to dangling clauses, and a cut on the edge of "be" is still
 * grammatically incomplete even if it doesn't split a word.
 * Do not infer punctuation from the end of a random transcript window:
 * examine only the exact retained words for each source selection.
 */
export function verifyFinishedThoughts(
  selections: EditorialSelection[], words: ClipWord[],
): void {
  for (const [index, selection] of selections.entries()) {
    const spoken = words.filter(w =>
      w.e * 1000 > selection.startMs && w.s * 1000 < selection.endMs)
      .sort((a,b) => a.s - b.s)
    if (spoken.length < 2) throw new Error('finisher_segment_without_speech')
    const tail = spoken[spoken.length-1]!.w.trim()
    const terminal = /[.!?]["'”’]?$/.test(tail) && !/\.{2,}["'”’]?$/.test(tail)
    const hasPunctuation = spoken.some(w => /[.!?]["'”’]?$/.test(w.w.trim()))
    const trailingFunction = /^(a|an|the|in|on|at|to|for|of|and|but|or|because|with|from|just|i|we|he|she|they|it|be|do|does|did|would|could|should|want|wanted|if|not|that|this|those|these)$/i.test(tail.replace(/[.,!?]+$/, ''))
    // Missing ALL punctuation is an ASR limitation, not proof of a bad
    // edit. But if the passage includes sentence punctuation then a cut on
    // "course," or "over," is demonstrably not the last complete sentence.
    if (trailingFunction || /\.{2,}$/.test(tail) || (hasPunctuation && !terminal)) {
      throw new Error('finisher_incomplete_segment_' + index)
    }
  }
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
  const selections = snapEditorialSelections(p.selections, bounds, words, footage)
  checkEditorialSelections(selections, bounds, words, footage)
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
  const finalWords = words.filter(w => w.e * 1000 > last.startMs && w.s * 1000 < last.endMs + 100)
    .sort((a, b) => a.s - b.s)
  const lastWord = finalWords[finalWords.length - 1]?.w.trim() ?? ''
  if (/^(a|an|the|in|on|at|to|for|of|and|but|or|because|with|from|just|i|we|he|she|they|it)$/i.test(lastWord.replace(/[.,!?]+$/, '')) ||
      /\.{2,}$/.test(lastWord)) {
    throw new Error('finisher_mid_sentence_ending')
  }
  // Enforce sentence completeness after the established payoff/edge error
  // diagnostics, so failures remain actionable instead of being masked.
  verifyFinishedThoughts(selections, words)
  const duration = seconds(selections)
  if (duration > target[1] * 1.2) throw new Error('finisher_still_over_target')
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
function dangling(w: string): boolean {
  return /^(a|an|the|in|on|at|to|for|of|and|but|or|because|with|from|just|i|we|he|she|they|it)$/i.test(w.trim().replace(/[.,!?]+$/, '')) ||
    /\.{2,}$/.test(w.trim())
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
    if (!Number.isInteger(selection.startMs) || !Number.isInteger(selection.endMs) ||
        selection.startMs < original.startMs || selection.endMs > original.endMs ||
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
    const spoken = sourceWords(words, selection.startMs, selection.endMs)
    if (!spoken.length || dangling(spoken[spoken.length - 1]!.w)) {
      throw new Error('highlights_finisher_mid_sentence_ending')
    }
    verifyFinishedThoughts([selection], words)
    // Detect obvious mid-sentence cut-ins by requiring an actual sentence
    // boundary shortly before each selected opening, or source start. The
    // context rule is advisory elsewhere; here only an obvious dangling
    // starting fragment is rejected.
    if (/^(and|but|because|which|whose|that|with|to)$/i.test(spoken[0]!.w.replace(/[^a-z]/gi, ''))) {
      throw new Error('highlights_finisher_mid_sentence_opening')
    }
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
  outline: { logline: string; audiencePromise: string; beats: string[] },
  footage: EditorialSelection[],
): Promise<HighlightsFinisherDecision> {
  const words = ctx.cache.words ?? []
  const source = ctx.sources[0]
  if (!source?.rangeMs || !words.length || footage.length < 2) throw new Error('highlights_finisher_source_unavailable')
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      'You are HIGHLIGHTS FINISHER, the same editorial completion specialist as Story Finisher, but with a DIFFERENT completion criterion.',
      'There is NO single shared narrative payoff. Each curated highlight must be independently interesting and comprehensible, with its own setup and source-spoken punchline, revelation, conclusion or natural landing.',
      'Preserve EXACTLY ONE source interval for EACH of the curated highlights in the SAME order. You can shorten within those bounds but cannot omit a highlight, add new footage, move it, or join all moments into one long narrative. Even the long last highlight must be compressed.',
      'Choose a whole-thought beginning and ending for EACH interval. Never end with "And", "In the", a dangling clause, or an incomplete question. Do not claim quotes not literally spoken. Give a 2+ word timed landing quote near each end, then stop (max 4 seconds after landing).',
      'Aim at the total requested duration without padding; keep source-referenced absolute millisecond positions. You have timed ASR words for each candidate with 3 seconds of context. Submit one submit_highlights_finish tool call.',
    ].join('\\n\\n') },
    { role: 'user', content: JSON.stringify({
      outline, targetSeconds: ctx.config.targetLengthS,
      originalSeconds: seconds(footage), curatedHighlights: footage,
      timedWords: transcriptFor(words, footage),
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
  outline: { logline: string; audiencePromise: string; beats: string[] },
  footage: EditorialSelection[],
): Promise<StoryFinisherDecision> {
  const words = ctx.cache.words ?? []
  const source = ctx.sources[0]
  if (!source?.rangeMs || !words.length || !footage.length) throw new Error('finisher_source_unavailable')
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      'You are STORY FINISHER, a specialist between Footage and Dialogue. Your only jobs are: identify the ACTUAL recorded payoff, remove irrelevant surrounding talk, and end the story at a complete natural thought. Do not assemble media or change chronology.',
      'Use ONLY intervals inside the provided Footage selections; no invented quotes or events. You may shorten or omit passages, not add new footage. Do not conflate a promised outcome in the outline with evidence in the transcript. If the promised payoff does not exist in the sourced words, DO NOT fake it; the run preserves an editable draft flagged for review.',
      'A source-backed payoff is a precise 2+ word quote and timestamp, included in the LAST selected passage. Keep only a short natural reaction after the payoff (<=8 seconds). EVERY retained passage must END at a complete sentence, not a comma or connector; a word-safe boundary alone is not enough. If you end a sentence before a dangling continuation, stop at that sentence timestamp. Do not keep the lead-in to the next thought. Aim for the target duration (at least 75% of requested minimum), not a 51-second cut when 75-105 seconds were requested. Preserve essential setup, obstacle, and result.',
      'Use absolute source milliseconds and whole-word boundaries. Submit via submit_story_finish. The supplied segment transcripts are real ASR evidence, with 3 seconds on either side for context.',
    ].join('\n\n') },
    { role: 'user', content: JSON.stringify({
      outline, targetSeconds: ctx.config.targetLengthS,
      originalSeconds: seconds(footage), curatedSelections: footage,
      candidateTranscripts: transcriptFor(words, footage),
      instruction: 'Decide where the story ACTUALLY resolves. Cut redundant adjacent talk, especially after the verified payoff. Keep a coherent complete story. Return all retained intervals and verified payoff quote with matching timestamps.',
    }) },
  ]
  let reason = 'finisher_no_usable_decision'
  for (let attempt = 0; attempt < 2; attempt++) {
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
      await logAiProducerStep({
        runId: ctx.runId, stepIndex: budget.steps, phase: 'plan', kind: 'validate',
        tool: 'story_finisher_rejected', error: reason,
        resultSummary: reason,
      })
      if (call) messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({
        ok: false, error: reason,
        instruction: 'Every selected segment must end on an actual complete sentence with sentence-final punctuation where the transcript provides it (never a comma, dangling And, or clause fragment). Match spoken payoff words exactly, preserve target length, and stay within curated intervals. Resubmit.',
      }) })
    }
  }
  throw new Error(reason)
}

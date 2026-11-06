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
  const duration = seconds(selections)
  if (duration > target[1] * 1.2) throw new Error('finisher_still_over_target')
  // Avoid a technically valid two-second soundbite framed as a complete story.
  if (duration < Math.min(target[0] * 0.5, 25)) throw new Error('finisher_overshort_story')
  return { selections, payoff: {
    startMs: payoff.startMs, endMs: payoff.endMs, quote: payoff.quote.slice(0, 180),
  }, editorialReason: p.editorialReason.slice(0, 500) }
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
      'A source-backed payoff is a precise 2+ word quote and timestamp, included in the LAST selected passage. Keep only a short natural reaction after the payoff (<=8 seconds). Do not leave a dangling sentence. Aim for the target duration, not an overlong transcript dump. Preserve the essential setup, obstacle, and result.',
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
        instruction: 'Only quote real retained speech, end within 8 seconds after payoff, use word-safe cut boundaries, stay within curated intervals and target duration. Resubmit.',
      }) })
    }
  }
  throw new Error(reason)
}

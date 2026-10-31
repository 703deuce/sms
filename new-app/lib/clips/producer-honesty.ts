import type { ProducerToolCall } from '@/lib/clips/edits-reducer'
import type { ClipEditsV2 } from '@/lib/clips/edits'

/**
 * E4fix: keep the Producer honest.
 * - A reducer summary that describes a no-op ("No music to mix", "No caption change needed", …)
 *   is not a change: it must not count toward changeCount, open a proposal, or render "Applied".
 * - "Add background music" with no music on the clip is a paid generate_music request (cost card →
 *   Generate), not a free mix tweak on nothing.
 * - When nothing changed, the reply must not claim it did.
 */

export function isNoopProducerSummary(s: string): boolean {
  return /^(No |Missing |Nothing )/i.test(s.trim())
}

export function isPendingProducerSummary(s: string): boolean {
  return /^Pending /.test(s.trim())
}

/** Summaries that describe a real, applied change. */
export function appliedProducerSummaries(summaries: string[]): string[] {
  return summaries.filter((s) => !isPendingProducerSummary(s) && !isNoopProducerSummary(s))
}

const DEFAULT_MUSIC_PROMPT = 'upbeat instrumental background music'

/** set_music_mix on a clip with no music (and no generate_music) → also queue generate_music for confirm. */
export function promoteMusicMixWithoutMusic(edits: ClipEditsV2, tools: ProducerToolCall[]): ProducerToolCall[] {
  if (edits.audio?.music) return tools
  if (!tools.some((t) => t.name === 'set_music_mix')) return tools
  if (tools.some((t) => t.name === 'generate_music')) return tools
  const mix = tools.find((t) => t.name === 'set_music_mix')
  const prompt = typeof mix?.args?.prompt === 'string' && mix.args.prompt.trim() ? mix.args.prompt : DEFAULT_MUSIC_PROMPT
  return [...tools, { name: 'generate_music', args: { prompt }, requiresConfirm: true }]
}

const CLAIM_RE = /\b(added|adding|applied|updated|changed|set to|switched|inserted|removed|trimmed|generated|made)\b/i

/** Replace a reply that claims a change when the patch changed nothing. "already …" replies are kept. */
export function honestProducerReply(
  reply: string | undefined,
  changeCount: number,
  pendingPaid: ProducerToolCall[],
  summaries: string[],
): string | undefined {
  if (changeCount > 0) return reply
  const text = (reply ?? '').trim()
  if (/\balready\b/i.test(text) && !/\badded\b/i.test(text)) return reply
  if (text && !CLAIM_RE.test(text)) return reply
  if (pendingPaid.length) {
    const names = pendingPaid.map((t) => t.name.replace(/^generate_/, '').replace(/_/g, ' ')).join(', ')
    return `Nothing has been changed yet — ${names} uses credits. Review the cost below and press Generate to create it.`
  }
  const noops = summaries.filter(isNoopProducerSummary)
  return noops.length ? `No changes made (${noops.join('; ')}).` : 'No changes made.'
}

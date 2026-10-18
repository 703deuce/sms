import { CALLS, THREADS, type Call } from './data'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function phoneMetrics(calls: Call[] = CALLS) {
  const inbound = calls.filter((c) => c.direction === 'inbound')
  const outbound = calls.filter((c) => c.direction === 'outbound')
  return {
    inbound: inbound.length,
    outbound: outbound.length,
    missed: calls.filter((c) => c.outcome === 'missed').length,
    voicemail: calls.filter((c) => c.outcome === 'voicemail').length,
    talkSec: sum(calls.filter((c) => c.outcome === 'answered').map((c) => c.durationSec)),
    callbacksOpen: calls.filter((c) => c.callbackNeeded && !c.handled).length,
    uniqueCallers: new Set(inbound.map((c) => c.callerNumber)).size,
    recordings: calls.filter((c) => c.recording).length,
  }
}

export function aiMetrics(calls: Call[] = CALLS) {
  const ai = calls.filter((c) => c.ai)
  const count = (o: string) => ai.filter((c) => c.ai?.outcome === o).length
  return {
    handled: ai.length,
    booked: count('booked'),
    transferred: count('transferred'),
    callbacks: count('callback'),
    messages: count('message'),
    unresolved: count('unresolved'),
    failed: count('failed'),
    needsAttention: ai.filter((c) => c.ai?.followUp === 'open').length,
    avgSec: ai.length ? Math.round(sum(ai.map((c) => c.durationSec)) / ai.length) : 0,
  }
}

export function mctbMetrics(calls: Call[] = CALLS) {
  const missed = calls.filter((c) => c.mctb)
  const consented = missed.filter((c) => c.mctb?.pressOne === 'pressed')
  const sent = missed.filter((c) => c.mctb && c.mctb.messageStatus !== 'not_sent')
  const delivered = missed.filter((c) => c.mctb?.messageStatus === 'delivered')
  const replied = missed.filter((c) => c.mctb?.state === 'replied' || c.mctb?.reply)
  const offered = missed.filter((c) => c.mctb?.pressOne !== 'not_offered')
  return {
    missed: missed.length,
    eligible: missed.filter((c) => c.mctb?.state !== 'suppressed').length,
    offered: offered.length,
    consented: consented.length,
    sent: sent.length,
    delivered: delivered.length,
    replied: replied.length,
    needsCallback: missed.filter((c) => c.mctb?.state === 'needs_callback').length,
    suppressed: missed.filter((c) => c.mctb?.state === 'suppressed').length,
    failed: missed.filter((c) => c.mctb?.state === 'failed').length,
  }
}

export function inboxMetrics() {
  return {
    unread: THREADS.filter((t) => t.unread).length,
    needsReply: THREADS.filter((t) => t.needsReply).length,
  }
}

export const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`)

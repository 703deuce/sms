/** Producer questions are customer text, not telemetry. Preserve the actual question. */
export function customerQuestion(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 2000)
}
/** An unanswered producer question takes priority over all asynchronous progress. */
export function progressMayChangeWaiting(status: string): boolean {
  return status !== 'needs_input'
}
export const CUSTOMER_WAIT_MS = 24 * 60 * 60 * 1000
export function waitingExpired(since: Date, now: Date = new Date()): boolean {
  return now.getTime() - since.getTime() >= CUSTOMER_WAIT_MS
}

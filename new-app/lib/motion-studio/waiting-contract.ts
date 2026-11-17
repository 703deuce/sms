/** Producer questions are customer text, not telemetry. Preserve the actual question. */
export function customerQuestion(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 2000)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{12,}/gi, 'Bearer [redacted]')
    .replace(/\b(api[_-]?key|access[_-]?token|secret)\s*[:=]\s*[^\s,;]{12,}/gi, '$1=[redacted]')
}
/** An unanswered producer question takes priority over all asynchronous progress. */
export function progressMayChangeWaiting(status: string): boolean {
  return status !== 'needs_input'
}
export const CUSTOMER_WAIT_MS = 24 * 60 * 60 * 1000
export function waitingExpired(since: Date, now: Date = new Date()): boolean {
  return now.getTime() - since.getTime() >= CUSTOMER_WAIT_MS
}

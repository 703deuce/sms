import 'server-only'

/** Redact URLs, query strings, and secret-like tokens for server logs. */
export function safeAdStudioLogMessage(err: unknown, maxLen = 320): { name: string; message: string } {
  const name = err instanceof Error ? err.name : typeof err
  const raw = err instanceof Error ? err.message : String(err)
  const message = raw
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\?[^\s]+/g, '')
    .replace(/\b(?:bearer|authorization|xi-api-key|api[_-]?key|token|sig|signature)\b[^\s,;]*/gi, '[redacted]')
    .slice(0, maxLen)
  return { name, message }
}

/** Additive structured clipper stage log. Never logs secrets, keys, tokens, or signed URLs. */
const SECRET = /(signed|signature|token|secret|password|authorization|api[_-]?key|x-goog-|aws4-hmac)/i
const URL = /https?:\/\/[^\s"]+/gi

function redact(value: string): string {
  return value.replace(URL, '(redacted)').replace(SECRET, '(redacted)')
}

export function clipperStageLog(rec: {
  stage: string
  action?: string
  projectId?: string
  jobId?: string
  runId?: string
  error?: unknown
  [key: string]: unknown
}): void {
  const out: Record<string, unknown> = {
    event: 'clipper_stage',
    stage: rec.stage,
    action: rec.action ?? 'info',
  }
  for (const [key, value] of Object.entries(rec)) {
    if (key === 'stage' || key === 'action' || value == null) continue
    if (key === 'error') {
      const err = value as { message?: string; stack?: string }
      out.error = redact(String(err?.message ?? value).slice(0, 800))
      if (err?.stack) out.traceback = redact(String(err.stack).slice(0, 4000))
      continue
    }
    out[key] = typeof value === 'string' ? redact(value) : value
  }
  console.log(JSON.stringify(out))
}

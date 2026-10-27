import 'server-only'

const SECRET_KEYS = /url|key|token|secret|password|authorization|signed/i

function sanitize(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (SECRET_KEYS.test(k)) continue
    if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) continue
    out[k] = v
  }
  return out
}

/** Structured T2V server logs — never pass secrets, tokens, or signed URLs in ctx. */
export function logT2v(feature: string, message: string, ctx?: Record<string, unknown>) {
  const tag = `[t2v:${feature}]`
  if (ctx && Object.keys(ctx).length) {
    console.info(tag, message, sanitize(ctx))
  } else {
    console.info(tag, message)
  }
}

export function logT2vError(feature: string, message: string, err: unknown, ctx?: Record<string, unknown>) {
  const tag = `[t2v:${feature}]`
  const base = {
    ...(ctx ? sanitize(ctx) : {}),
    error: err instanceof Error ? err.message : String(err),
  }
  console.error(tag, message, base)
}

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

export function logEditor(feature: string, message: string, ctx?: Record<string, unknown>) {
  const tag = `[editor:${feature}]`
  if (ctx && Object.keys(ctx).length) {
    console.info(tag, message, sanitize(ctx))
  } else {
    console.info(tag, message)
  }
}

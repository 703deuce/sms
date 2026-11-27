/** In-memory per-client rate limit for public Agent Lab API routes (no login by design). */

const buckets = new Map<string, number[]>()

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = (forwarded?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim()
  return ip.slice(0, 80) || 'unknown'
}

/** Returns true if the request is allowed. */
export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 10_000) {
    const cutoff = now - windowMs
    for (const [k, v] of buckets) {
      const kept = v.filter((t) => t > cutoff)
      if (kept.length === 0) buckets.delete(k)
      else buckets.set(k, kept)
    }
  }
  return true
}

export function rateLimitedResponse(): Response {
  return Response.json(
    { error: 'Too many requests. Please wait a minute and try again.' },
    { status: 429, headers: { 'Retry-After': '60' } },
  )
}

/** In-memory idempotency cache for sensitive API mutations (matches rate-limit pattern). */

const TTL_MS = 10 * 60 * 1000;
const MAX_KEY_LEN = 128;

type CacheEntry = {
  status: number;
  body: unknown;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function prune(now: number): void {
  if (cache.size <= 5_000) return;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get("Idempotency-Key")?.trim();
  if (!raw || raw.length > MAX_KEY_LEN) return null;
  return raw;
}

export function getIdempotentResponse(key: string): CacheEntry | null {
  const now = Date.now();
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return hit;
}

export function storeIdempotentResponse(
  key: string,
  status: number,
  body: unknown
): void {
  const now = Date.now();
  cache.set(key, { status, body, expiresAt: now + TTL_MS });
  prune(now);
}

export function resetIdempotencyCacheForTests(): void {
  cache.clear();
}

/** Pure Pixabay hit reranking by tag/query keyword overlap (unit-testable). */

export type PixabayHitForRerank = {
  providerId: string
  tags: string
  durationS?: number
}

const GENERIC_TAG_TOKENS = new Set([
  'animal',
  'animals',
  'book',
  'books',
  'food',
  'nature',
  'video',
  'background',
  'peanut',
  'peanuts',
  'squirrel',
  'squirrels',
  'nut',
  'nuts',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

function distinctQueryTokens(query: string, mustInclude: string[]): string[] {
  const out = new Set<string>()
  for (const w of tokenize(query)) {
    if (!GENERIC_TAG_TOKENS.has(w)) out.add(w)
  }
  for (const m of mustInclude) {
    const t = m.toLowerCase().trim()
    if (t.length >= 2) out.add(t)
  }
  return [...out]
}

export function tagKeywordOverlapScore(
  tags: string,
  query: string,
  mustInclude: string[],
): number {
  const tagTokens = new Set(tokenize(tags))
  let score = 0
  for (const w of tokenize(query)) {
    if (tagTokens.has(w)) score += 2
    else if (tagTokens.has(w.replace(/s$/, ''))) score += 1
  }
  for (const req of mustInclude) {
    const t = req.toLowerCase().trim()
    if (!t) continue
    if (tagTokens.has(t)) score += 3
    else if ([...tagTokens].some((tag) => tag.includes(t) || t.includes(tag))) score += 2
  }
  return score
}

/** Require strong tag overlap — blocks single generic-token matches (e.g. squirrel for comic strip). */
export function passesPixabayRelevance(tags: string, query: string, mustInclude: string[]): boolean {
  const tagTokens = new Set(tokenize(tags))
  const queryTokens = distinctQueryTokens(query, mustInclude)
  if (!queryTokens.length) return false

  let matched = 0
  for (const q of queryTokens) {
    if (tagTokens.has(q) || tagTokens.has(q.replace(/s$/, ''))) matched += 1
  }

  const must = mustInclude.map((m) => m.toLowerCase().trim()).filter(Boolean)
  const mustHit = must.some(
    (m) => tagTokens.has(m) || [...tagTokens].some((t) => t.includes(m) || m.includes(t)),
  )

  if (must.length && mustHit && matched >= 1) return true
  return matched >= 2
}

export function filterAndRankPixabayHits<T extends PixabayHitForRerank>(
  hits: T[],
  query: string,
  mustInclude: string[],
): T[] {
  const scored = hits
    .map((h) => ({ h, score: tagKeywordOverlapScore(h.tags, query, mustInclude) }))
    .filter((x) => x.score > 0 && passesPixabayRelevance(x.h.tags, query, mustInclude))
    .sort((a, b) => b.score - a.score)
  return scored.map((x) => x.h)
}

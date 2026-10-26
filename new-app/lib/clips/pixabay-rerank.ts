/** Pure Pixabay hit reranking by tag/query keyword overlap (unit-testable). */

export type PixabayHitForRerank = {
  providerId: string
  tags: string
  durationS?: number
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
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

export function filterAndRankPixabayHits<T extends PixabayHitForRerank>(
  hits: T[],
  query: string,
  mustInclude: string[],
): T[] {
  const scored = hits
    .map((h) => ({ h, score: tagKeywordOverlapScore(h.tags, query, mustInclude) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.map((x) => x.h)
}

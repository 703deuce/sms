/** Contract from #1111 / #1118: optional fields on clip.aiMeta. Absent fields are not a review flag. */

export type ClipNeedsReviewFields = {
  needsReview?: boolean
  needsReviewReasons?: string[]
}

const REASON_LIMIT = 10

function asMeta(aiMeta: unknown): Record<string, unknown> | null {
  if (!aiMeta || typeof aiMeta !== 'object' || Array.isArray(aiMeta)) return null
  return aiMeta as Record<string, unknown>
}

/** True only when the published flag is explicitly true. Missing/false/undefined stays quiet. */
export function clipNeedsReview(aiMeta: unknown): boolean {
  return asMeta(aiMeta)?.needsReview === true
}

/** Up to 10 non-empty reason strings. Empty when the clip is not flagged. */
export function clipNeedsReviewReasons(aiMeta: unknown): string[] {
  if (!clipNeedsReview(aiMeta)) return []
  const raw = asMeta(aiMeta)?.needsReviewReasons
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const text = item.trim()
    if (!text) continue
    out.push(text)
    if (out.length >= REASON_LIMIT) break
  }
  return out
}

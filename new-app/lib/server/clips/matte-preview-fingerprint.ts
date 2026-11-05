import { createHash } from 'node:crypto'

/** Stable identity of the source media used for a six-second preview matte. */
export function mattePreviewFingerprint(clip: {
  sourceSegKey?: string | null
  sourceSegStartMs?: number | null
  previewKey?: string | null
  startMs: number
  endMs: number
  edits?: unknown
}): string {
  // Edits affect which frames appear at output 0–6s (trim and cuts).
  // Do not reuse a matte after an edit changes the underlying subject footage.
  const edits = clip.edits && typeof clip.edits === 'object' && !Array.isArray(clip.edits)
    ? clip.edits as Record<string, unknown> : {}
  const trim = edits.trim && typeof edits.trim === 'object' ? edits.trim : null
  return createHash('sha256').update(JSON.stringify([
    clip.sourceSegKey ?? null, clip.sourceSegStartMs ?? null,
    clip.previewKey ?? null, clip.startMs, clip.endMs,
    trim, edits.cutRanges ?? null, edits.sectionOrder ?? null,
    edits.inserts ?? null, edits.speed ?? null, edits.speedCurves ?? null,
  ])).digest('hex').slice(0, 32)
}

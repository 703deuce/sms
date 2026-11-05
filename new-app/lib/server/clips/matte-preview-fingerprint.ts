import { createHash } from 'node:crypto'

/** Stable identity of the source media used for a six-second preview matte. */
export function mattePreviewFingerprint(clip: {
  sourceSegKey?: string | null
  sourceSegStartMs?: number | null
  previewKey?: string | null
  startMs: number
  endMs: number
}): string {
  return createHash('sha256').update(JSON.stringify([
    clip.sourceSegKey ?? null, clip.sourceSegStartMs ?? null,
    clip.previewKey ?? null, clip.startMs, clip.endMs,
  ])).digest('hex').slice(0, 32)
}

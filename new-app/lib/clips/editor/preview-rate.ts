/**
 * TC1 (TL-39): preview playback speed (0.25×–2×). Editor-only — multiplies the preview's playbackRate,
 * never saved, never exported. A tiny module store so the timeline toolbar and the preview stage share
 * it without prop drilling.
 */
export const PREVIEW_RATES = [0.25, 0.5, 0.75, 1, 1.5, 2] as const
export type PreviewRate = (typeof PREVIEW_RATES)[number]

let rate: PreviewRate = 1
const subs = new Set<() => void>()

export function getPreviewRate(): PreviewRate {
  return rate
}

export function setPreviewRate(r: number): void {
  const next = (PREVIEW_RATES as readonly number[]).includes(r) ? (r as PreviewRate) : 1
  if (next === rate) return
  rate = next
  subs.forEach((f) => f())
}

export function subscribePreviewRate(f: () => void): () => void {
  subs.add(f)
  return () => subs.delete(f)
}

/** Cycle to the next / previous rate (keyboard). */
export function stepPreviewRate(dir: 1 | -1): PreviewRate {
  const i = PREVIEW_RATES.indexOf(rate)
  const j = Math.max(0, Math.min(PREVIEW_RATES.length - 1, i + dir))
  setPreviewRate(PREVIEW_RATES[j]!)
  return rate
}

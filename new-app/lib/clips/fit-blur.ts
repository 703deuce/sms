/**
 * E6: fit/blur background strength — one table for the editor preview and the worker export
 * (worker/clips_worker/filtergraph.py FIT_BLUR_SIGMA_FRAC). Gaussian sigma as a fraction of the
 * output (stage) width, so the preview looks the same at any zoom. "soft" = the pre-E6 export blur.
 */
export const FIT_BLUR_STRENGTHS = ['soft', 'strong', 'max'] as const
export type FitBlurStrength = (typeof FIT_BLUR_STRENGTHS)[number]
export const DEFAULT_FIT_BLUR_STRENGTH: FitBlurStrength = 'strong'
export const FIT_BLUR_SIGMA_FRAC: Record<FitBlurStrength, number> = { soft: 0.028, strong: 0.075, max: 0.13 }
const BRIGHTNESS: Record<FitBlurStrength, number> = { soft: 0.94, strong: 0.92, max: 0.9 }

export const FIT_BLUR_LABELS: Record<FitBlurStrength, string> = { soft: 'Soft', strong: 'Strong', max: 'Max' }

export function normalizeFitBlurStrength(raw: unknown): FitBlurStrength | undefined {
  return typeof raw === 'string' && (FIT_BLUR_STRENGTHS as readonly string[]).includes(raw)
    ? (raw as FitBlurStrength)
    : undefined
}

export function fitBlurStrength(edits: { layout?: { blurStrength?: unknown } } | null | undefined): FitBlurStrength {
  return normalizeFitBlurStrength(edits?.layout?.blurStrength) ?? DEFAULT_FIT_BLUR_STRENGTH
}

/** CSS filter for a blurred background element that spans ``stageWidthPx`` (the 1080-wide frame in preview px). */
export function fitBlurCssFilter(strength: FitBlurStrength, stageWidthPx: number): string {
  const w = Number.isFinite(stageWidthPx) && stageWidthPx > 0 ? stageWidthPx : 360
  const px = Math.max(4, Math.round(FIT_BLUR_SIGMA_FRAC[strength] * w * 10) / 10)
  return `blur(${px}px) brightness(${BRIGHTNESS[strength]})`
}

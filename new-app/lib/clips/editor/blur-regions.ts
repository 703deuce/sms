/**
 * G4c blur regions on the main video (privacy blur), output (edit) ms. Mirror of the worker's
 * clips_worker/blur_regions.py.
 *
 *  manual  a G4b shape mask (rect / ellipse / …, feather, invert) with keyframed geometry in ms
 *          from the region start — the preview draws the same mask (CSS mask-image of the same
 *          low-res grid + backdrop-filter blur), so preview = export.
 *  faces   the worker's self-hosted YuNet detector (CPU, no API) finds faces every 100 ms and
 *          blurs a feathered ellipse per face; the preview cannot run it and shows the manual
 *          mask with a "faces are found on export" note. No detector → the manual mask is used.
 *
 * Strength: Gaussian sigma = amount / 100 × BLUR_UNIT × short side (CSS blur radius on the
 * displayed frame uses the same unit).
 */
import { DEFAULT_MASK, normalizeMask, type LayerMask } from '@/lib/clips/editor/layer-fx'

export type BlurMode = 'manual' | 'faces'
export type BlurRegion = { id: string; startMs: number; endMs: number; mode: BlurMode; amount: number; mask: LayerMask }

export const BLUR_MAX_REGIONS = 20
export const BLUR_UNIT = 0.04
export const BLUR_DEFAULT = 60
export const BLUR_DEFAULT_LEN_MS = 3000
export const BLUR_MODES: readonly BlurMode[] = ['manual', 'faces']
export const DEFAULT_BLUR_MASK: LayerMask = { shape: 'ellipse', x: 50, y: 40, w: 30, h: 40, rot: 0, feather: 20 }
const ID = /^[A-Za-z0-9_-]{1,64}$/

const num = (v: unknown): number | null => {
  if (typeof v === 'boolean') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

export function normalizeBlurRegions(raw: unknown): BlurRegion[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: BlurRegion[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (typeof o.id !== 'string' || !ID.test(o.id) || seen.has(o.id)) continue
    const a0 = num(o.startMs)
    const b0 = num(o.endMs)
    if (a0 == null || b0 == null) continue
    const a = Math.max(0, Math.floor(a0 + 0.5))
    const b = Math.floor(b0 + 0.5)
    if (b - a < 100) continue
    const amt = num(o.amount)
    seen.add(o.id)
    out.push({
      id: o.id,
      startMs: a,
      endMs: b,
      mode: o.mode === 'faces' ? 'faces' : 'manual',
      amount: amt == null ? BLUR_DEFAULT : Math.max(1, Math.min(100, Math.floor(amt + 0.5))),
      mask: normalizeMask(o.mask) ?? { ...DEFAULT_BLUR_MASK },
    })
    if (out.length >= BLUR_MAX_REGIONS) break
  }
  out.sort((p, q) => p.startMs - q.startMs || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
  return out.length ? out : undefined
}

/** CSS / ffmpeg Gaussian sigma in px of a frame whose short side is `shortPx`. */
export function blurSigma(amount: number, shortPx: number): number {
  return Math.round((amount / 100) * BLUR_UNIT * shortPx * 1000) / 1000
}

export function blurRegionsAt(list: BlurRegion[] | undefined, outMs: number): BlurRegion[] {
  return (list ?? []).filter((r) => r.startMs <= outMs && outMs < r.endMs)
}

export function newBlurRegionId(list: BlurRegion[] | undefined): string {
  const ids = new Set((list ?? []).map((r) => r.id))
  let n = (list?.length ?? 0) + 1
  while (ids.has(`blur${n}`)) n++
  return `blur${n}`
}

/** Add a region at the playhead (default 3 s, clamped to the video). */
export function addBlurRegion(list: BlurRegion[] | undefined, atMs: number, durationMs: number): { list: BlurRegion[]; id: string } | null {
  if ((list?.length ?? 0) >= BLUR_MAX_REGIONS) return null
  const start = Math.max(0, Math.min(Math.round(atMs), Math.max(0, durationMs - 100)))
  const end = Math.min(Math.max(start + 100, durationMs), start + BLUR_DEFAULT_LEN_MS)
  if (end - start < 100) return null
  const id = newBlurRegionId(list)
  const row: BlurRegion = { id, startMs: start, endMs: end, mode: 'manual', amount: BLUR_DEFAULT, mask: { ...DEFAULT_BLUR_MASK } }
  return { list: normalizeBlurRegions([...(list ?? []), row]) ?? [row], id }
}

export function patchBlurRegion(list: BlurRegion[] | undefined, id: string, patch: Partial<Omit<BlurRegion, 'id'>> | null): BlurRegion[] | undefined {
  if (!patch) return normalizeBlurRegions((list ?? []).filter((r) => r.id !== id))
  return normalizeBlurRegions((list ?? []).map((r) => (r.id === id ? { ...r, ...patch, id } : r)))
}

export { DEFAULT_MASK }

/**
 * G4c stabilize — `edits.stabilize` = [{fromMs, toMs, amount}] over SOURCE ms (like segmentSpeeds,
 * so a Video item keeps its stabilization through cuts / reorders). Mirror of the worker's
 * clips_worker/stabilize.py normalize_stabilize. Export-only processing: the worker runs vidstab
 * two-pass (or deshake when its ffmpeg lacks libvidstab) on full_render before color; the preview
 * shows the original frames with a "Stabilized on export" note.
 */
export type StabilizeRange = { fromMs: number; toMs: number; amount: number }

export const STAB_MAX_RANGES = 50
export const STAB_DEFAULT = 50
export const STAB_MIN_MS = 100

export function clampStabAmount(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isFinite(n)) return STAB_DEFAULT
  return Math.max(1, Math.min(100, Math.floor(n + 0.5)))
}

export function normalizeStabilize(raw: unknown): StabilizeRange[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const rows: StabilizeRange[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const a0 = Number(o.fromMs)
    const b0 = Number(o.toMs)
    if (!Number.isFinite(a0) || !Number.isFinite(b0)) continue
    const a = Math.max(0, pyRound(a0))
    const b = pyRound(b0)
    if (b - a < STAB_MIN_MS) continue
    rows.push({ fromMs: a, toMs: b, amount: clampStabAmount(o.amount ?? STAB_DEFAULT) })
  }
  rows.sort((p, q) => p.fromMs - q.fromMs || p.toMs - q.toMs)
  const out: StabilizeRange[] = []
  for (let r of rows) {
    const last = out[out.length - 1]
    if (last && r.fromMs < last.toMs) {
      r = { ...r, fromMs: last.toMs }
      if (r.toMs - r.fromMs < STAB_MIN_MS) continue
    }
    out.push(r)
  }
  return out.length ? out.slice(0, STAB_MAX_RANGES) : undefined
}

/** Python round() (banker's rounding) for parity with the worker normalizer. */
function pyRound(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

/** Stabilize amount covering a source range (exact match of a Video item), or null. */
export function stabilizeFor(list: StabilizeRange[] | undefined, fromMs: number, toMs: number): number | null {
  const hit = (list ?? []).find((r) => r.fromMs <= fromMs + 1 && r.toMs >= toMs - 1)
  return hit ? hit.amount : null
}

/** True when any stabilized range overlaps [fromMs, toMs). */
export function stabilizeOverlaps(list: StabilizeRange[] | undefined, fromMs: number, toMs: number): boolean {
  return (list ?? []).some((r) => r.fromMs < toMs && r.toMs > fromMs)
}

/** Set (amount) or clear (null) stabilization over a source range; other ranges are clipped. */
export function setStabilize(list: StabilizeRange[] | undefined, fromMs: number, toMs: number, amount: number | null): StabilizeRange[] | undefined {
  const a = Math.round(fromMs)
  const b = Math.round(toMs)
  const rest: StabilizeRange[] = []
  for (const r of list ?? []) {
    if (r.toMs <= a || r.fromMs >= b) {
      rest.push(r)
      continue
    }
    if (r.fromMs < a) rest.push({ ...r, toMs: a })
    if (r.toMs > b) rest.push({ ...r, fromMs: b })
  }
  if (amount != null && b - a >= STAB_MIN_MS) rest.push({ fromMs: a, toMs: b, amount: clampStabAmount(amount) })
  return normalizeStabilize(rest)
}

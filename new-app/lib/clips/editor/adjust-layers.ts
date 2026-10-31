/**
 * G4a adjustment layers (mirror: worker/clips_worker/adjust_layers.py).
 *
 * `edits.adjustLayers = [{id, startMs, endMs, spec}]` in OUTPUT ms. A layer grades everything below
 * it — the main video and the overlay (B-roll) tracks — for its span; text, captions and the export
 * template stay on top (CapCut "Adjustment" layer). Layers stack in list order (later = applied
 * last). Spec = a ColorSpec without HSL ranges / user LUT (those are per-clip in G4a). Keyframes:
 * target `adjust:<id>` (color props only, ms from the layer start).
 *
 * Imports only color.ts, so lib/clips/edits.ts can use it.
 */
import { normalizeColorSpec, type ColorSpec } from '@/lib/clips/editor/color'

export type AdjustLayer = { id: string; startMs: number; endMs: number; spec: ColorSpec; name?: string }

export const ADJUST_MAX = 20
export const ADJUST_MIN_MS = 100
export const ADJUST_DEFAULT_MS = 3000

/** HSL ranges and user LUTs are per-clip only in G4a (export pass + preview chain are SVG-exact). */
export function adjustSpec(raw: unknown): ColorSpec {
  if (!raw || typeof raw !== 'object') return {}
  const { hsl: _h, lut: _l, ...rest } = raw as Record<string, unknown>
  return normalizeColorSpec(rest) ?? {}
}

export function normalizeAdjustLayers(raw: unknown): AdjustLayer[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: AdjustLayer[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = o.id
    if (typeof id !== 'string' || !id || id.length > 64 || seen.has(id)) continue
    const a = Math.round(Number(o.startMs))
    const b = Math.round(Number(o.endMs))
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b - a < ADJUST_MIN_MS) continue
    seen.add(id)
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : undefined
    out.push({ id, startMs: a, endMs: b, spec: adjustSpec(o.spec), ...(name ? { name } : {}) })
    if (out.length >= ADJUST_MAX) break
  }
  return out.length ? out : undefined
}

export function adjustLabel(l: AdjustLayer, i: number): string {
  return l.name ?? `Adjustment ${i + 1}`
}

export function newAdjustId(existing: readonly AdjustLayer[] | undefined, seed = Date.now()): string {
  const ids = new Set((existing ?? []).map((l) => l.id))
  let n = (existing?.length ?? 0) + 1
  let id = `adj${n}_${(seed % 46656).toString(36)}`
  while (ids.has(id)) id = `adj${++n}_${(seed % 46656).toString(36)}`
  return id
}

/** Add a layer at [atMs, atMs + len) clamped to the video. */
export function addAdjustLayer(
  layers: readonly AdjustLayer[] | undefined,
  atMs: number,
  durationMs: number,
  seed?: number,
): { layers: AdjustLayer[]; id: string } | null {
  if ((layers?.length ?? 0) >= ADJUST_MAX || durationMs < ADJUST_MIN_MS) return null
  const a = Math.max(0, Math.min(Math.round(atMs), durationMs - ADJUST_MIN_MS))
  const b = Math.min(durationMs, a + ADJUST_DEFAULT_MS)
  const id = newAdjustId(layers, seed)
  return { layers: [...(layers ?? []), { id, startMs: a, endMs: Math.max(b, a + ADJUST_MIN_MS), spec: {} }], id }
}

export function patchAdjustLayer(
  layers: readonly AdjustLayer[] | undefined,
  id: string,
  patch: Partial<Omit<AdjustLayer, 'id'>>,
): AdjustLayer[] | undefined {
  const next = (layers ?? []).map((l) => (l.id === id ? { ...l, ...patch, ...(patch.spec ? { spec: adjustSpec(patch.spec) } : {}) } : l))
  return next.length ? next : undefined
}

export function removeAdjustLayer(layers: readonly AdjustLayer[] | undefined, id: string): AdjustLayer[] | undefined {
  const next = (layers ?? []).filter((l) => l.id !== id)
  return next.length ? next : undefined
}

/** Layers whose span contains outMs, in stacking order. */
export function adjustLayersAt(layers: readonly AdjustLayer[] | undefined, outMs: number): AdjustLayer[] {
  return (layers ?? []).filter((l) => l.startMs <= outMs && outMs < l.endMs)
}

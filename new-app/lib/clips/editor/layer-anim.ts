/**
 * G3b: in / out / loop presets on non-text layers (B-roll / images / overlays) for the editor
 * preview — the same math the export burns (worker motion.layer_anim_at / layer_anim_exprs: x / y
 * add in % of the frame, scale multiplies, rotation adds, opacity multiplies). Item-local ms.
 */
import { fitDurations, frameAnim, normLayerAnim, type TextAnim } from '@/lib/clips/render-plan/text-anim'
import { pyRound } from '@/lib/clips/render-plan/py'

export type LayerAnimState = { op: number; sc: number; dx: number; dy: number; rot: number }
export const LAYER_ANIM_IDENTITY: LayerAnimState = { op: 1, sc: 1, dx: 0, dy: 0, rot: 0 }

export function layerAnimAt(item: { startMs: number; endMs: number; anim?: unknown }, localMs: number): LayerAnimState {
  const a = normLayerAnim(item.anim)
  if (!a) return LAYER_ANIM_IDENTITY
  const ln = pyRound(item.endMs) - pyRound(item.startMs)
  if (ln <= 0) return LAYER_ANIM_IDENTITY
  const [dIn, dOut] = fitDurations(a, ln)
  const f = frameAnim(a, localMs, 0, ln, dIn, dOut)
  return { op: f.op, sc: f.sc, dx: f.dx, dy: f.dy, rot: f.rot }
}

/** G3b: splitting an animated item — the left half keeps the in (and loop), the right the out. */
export function splitAnim<T extends { anim?: TextAnim }>(item: T, side: 'left' | 'right'): T {
  const a = item.anim
  if (!a) return item
  const { in: aIn, out: aOut, ...rest } = a
  const next: TextAnim = side === 'left' ? { ...rest, ...(aIn ? { in: aIn } : {}) } : { ...rest, ...(aOut ? { out: aOut } : {}) }
  const out = { ...item }
  if (Object.keys(next).length) out.anim = next
  else delete out.anim
  return out
}

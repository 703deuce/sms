/**
 * G4a: the color spec actually in effect at a playhead — keyframed Adjust values (existing keyframe
 * system, color props) quantized to COLOR_STEP_MS, exactly like the worker's stepped windows
 * (color.video_grade_ranges / color.broll_color_filter / adjust_layers: color_grade.stepped_windows).
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { videoSpecAtSource, type ColorAdjustKey, type ColorSpec } from '@/lib/clips/editor/color'
import {
  COLOR_KEY_PROPS,
  COLOR_STEP_MS,
  FX_KEY_PROPS,
  quantFx,
  stepOf,
  type ColorKeyProp,
  type FxAnyKey,
  type FxKeyProp,
} from '@/lib/clips/editor/color-grade'
import { adjustLayersAt, type AdjustLayer } from '@/lib/clips/editor/adjust-layers'
import { isColorProp, PROP_SPECS, type KeyframeTrack } from '@/lib/clips/editor/motion-schema'
import { valueAtPoints } from '@/lib/clips/editor/keyframes'

export function colorTracks(edits: ClipEditsV2, target: string): KeyframeTrack[] {
  return (edits.keyframes ?? []).filter((k) => k.target === target && isColorProp(k.prop))
}

function trackValue(t: KeyframeTrack, localMs: number): number {
  const def = PROP_SPECS[t.prop].def
  if (!t.points.length) return t.value ?? def
  return valueAtPoints(t.points, localMs, def)
}

/** Spec with the keyframed Adjust values at the step containing localMs (color_grade.spec_with_overrides). */
export function specWithOverrides(spec: ColorSpec | undefined, tracks: KeyframeTrack[], localMs: number): ColorSpec | undefined {
  if (!tracks.length) return spec
  const t = stepOf(localMs) * COLOR_STEP_MS
  const base: ColorSpec = { ...(spec ?? {}) }
  const adj: Partial<Record<ColorAdjustKey, number>> = { ...(base.adjust ?? {}) }
  const fx: Partial<Record<FxAnyKey, number>> = { ...(base.fx ?? {}) }
  let fxKeyed = false
  for (const tr of tracks) {
    if (tr.prop in FX_KEY_PROPS) {
      // G4c: keyframed effect amount (quantized like color_grade.quant_fx)
      const q = quantFx(trackValue(tr, t))
      const fk = FX_KEY_PROPS[tr.prop as FxKeyProp]
      if (q) fx[fk] = q
      else delete fx[fk]
      fxKeyed = true
      continue
    }
    const v = Math.floor(trackValue(tr, t) + 0.5)
    const key = COLOR_KEY_PROPS[tr.prop as ColorKeyProp] as ColorAdjustKey
    if (v) adj[key] = v
    else delete adj[key]
  }
  if (Object.keys(adj).length) base.adjust = adj
  else delete base.adjust
  if (fxKeyed) {
    const clean = Object.fromEntries(Object.entries(fx).filter(([, v]) => Math.round(Number(v) || 0))) as typeof fx
    if (Object.keys(clean).length) base.fx = clean
    else delete base.fx
  }
  return base
}

/** Main video at a source ms / output ms (Video-target color keyframes are in output ms). */
export function videoGradeAt(edits: ClipEditsV2, srcMs: number, outMs: number | null): ColorSpec | undefined {
  const base = videoSpecAtSource(edits.color, srcMs)
  const tracks = colorTracks(edits, 'video')
  if (!tracks.length || outMs == null) return base
  return specWithOverrides(base ?? {}, tracks, outMs)
}

export function brollGradeAt(edits: ClipEditsV2, id: string, outMs: number): ColorSpec | undefined {
  const base = edits.color?.broll?.[id]
  const tracks = colorTracks(edits, `broll:${id}`)
  if (!tracks.length) return base
  const item = edits.broll?.find((b) => b.id === id)
  return specWithOverrides(base ?? {}, tracks, outMs - (item?.startMs ?? 0))
}

/** Active adjustment layers at outMs with their keyframed specs (stacking order). */
export function adjustGradesAt(edits: ClipEditsV2, outMs: number): { layer: AdjustLayer; spec: ColorSpec }[] {
  if (edits.timelineLanes?.adjust?.hidden) return []
  return adjustLayersAt(edits.adjustLayers, outMs).map((layer) => {
    const tracks = colorTracks(edits, `adjust:${layer.id}`)
    return { layer, spec: (tracks.length ? specWithOverrides(layer.spec, tracks, outMs - layer.startMs) : layer.spec) ?? {} }
  })
}

/**
 * E3 preview: per-frame styles for keyframes + transitions, from the shared math
 * (keyframes.ts / transitions.ts — the same functions the export parity fixture asserts).
 * Pure: the DOM side lives in components/clips/editor/motion-preview.ts.
 */
import type { BrollItem } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { keyframeGlobalEditMs } from '@/lib/clips/editor/keyframe-time'
import { LAYER_ANIM_IDENTITY, layerAnimAt } from '@/lib/clips/editor/layer-anim'
import {
  IDENTITY_TRANSFORM,
  isIdentityTransform,
  layerTransformAt,
  tracksFor,
  type LayerTransform,
} from '@/lib/clips/editor/keyframes'
import {
  brollTransitionWindows,
  brollVisibleRange,
  compositeCss,
  cutTransitionWindows,
  progressIn,
  SHADER_TRANSITIONS,
  shaderProgress,
  transitionFrame,
  type BrollWindow,
  type CutWindow,
  type LayerCss,
} from '@/lib/clips/editor/transitions'
import {
  cropClipPath,
  flipCss,
  intersectClipPaths,
  layerCropAt,
  layerFlip,
  mirrorClipPath,
} from '@/lib/clips/editor/layer-props'

export const HOOK_FADE_IN_MS = 180
export const HOOK_FADE_OUT_MS = 220

export type FrameStyle = {
  transform: string
  opacity: number
  clipPath: string
  filter: string
  visibility: 'visible' | 'hidden'
  /** G4b: mask-transition key (transitions.ts compositeCss) */
  mask?: string
}

const NONE: FrameStyle = { transform: '', opacity: 1, clipPath: '', filter: '', visibility: 'visible' }

/** Edit ms to sample keyframes at (matches export when segment/global speed warps the clock). */
function keyframeSampleOutMs(edits: ClipEditsV2, outMs: number): number {
  return keyframeGlobalEditMs(edits, outMs)
}

/** CSS transform of a frame-sized layer, origin set by the caller (centre for video / B-roll). */
export function keyframeTransform(t: LayerTransform): string {
  if (isIdentityTransform({ ...t, opacity: 100 })) return ''
  return `translate(${t.x}%, ${t.y}%) rotate(${t.rotation}deg) scale(${t.scale / 100})`
}

function join(...parts: string[]): string {
  return parts.filter(Boolean).join(' ')
}

export type MainFrame = {
  /** keyframes of the Video lane (whole main composite, like the export pass after the cut). */
  kf: FrameStyle
  /** active cut window (two clones A / B + dip colour), or null */
  cut: null | {
    win: CutWindow
    q: number
    /** source ms each clone must show at this output time */
    aSrcMs: number
    bSrcMs: number
    top: 'a' | 'b'
    pixel?: { blockFrac: number; P: number }
    shader?: { type: import('@/lib/clips/editor/g4/transition-shaders.gen').ShaderType; progress: number }
    a: LayerCss
    b: LayerCss
    color: { opacity: number; background: string }
  }
  /** next window starting within `preRollMs` (to pre-seek the clones) */
  upcoming: null | { win: CutWindow; aSrcMs: number; bSrcMs: number }
}

export function mainFrame(
  edits: ClipEditsV2,
  tb: { segs: [number, number][]; starts: number[] },
  outMs: number,
  boxW: number,
  preRollMs = 1500,
): MainFrame {
  const kfMs = keyframeSampleOutMs(edits, outMs)
  const t = tracksFor(edits, 'video').length ? layerTransformAt(edits, 'video', kfMs) : IDENTITY_TRANSFORM
  // G1a: crop (element-local clip) + flip (last transform function → applied first), as the export.
  const flip = layerFlip(edits, 'video')
  const kf: FrameStyle = {
    ...NONE,
    transform: join(keyframeTransform(t), flipCss(flip)),
    opacity: t.opacity / 100,
    clipPath: cropClipPath(layerCropAt(edits, 'video', kfMs)),
  }
  const wins = cutTransitionWindows(tb.segs, tb.starts, edits.transitions)
  let cut: MainFrame['cut'] = null
  let upcoming: MainFrame['upcoming'] = null
  for (const w of wins) {
    if (outMs >= w.w0Ms && outMs < w.w1Ms) {
      const q = progressIn(w, frameTime(outMs, w))
      const f = transitionFrame(w.type, q)
      // DOM order: clone A below, dip colour, clone B on top.
      const css = compositeCss(f, false, boxW)
      cut = {
        win: w,
        q,
        aSrcMs: w.aEnd + (outMs - w.cutMs),
        bSrcMs: w.bStart + (outMs - w.cutMs),
        top: css.top,
        pixel: f.pixel,
        a: css.a,
        b: css.b,
        color: css.color,
      }
      if (SHADER_TRANSITIONS.has(w.type)) {
        const k = Math.round(q * w.frames)
        cut.shader = { type: w.type as import('@/lib/clips/editor/g4/transition-shaders.gen').ShaderType, progress: shaderProgress(k, w.frames) }
      }
      break
    }
    if (!upcoming && w.w0Ms > outMs && w.w0Ms - outMs <= preRollMs) {
      upcoming = { win: w, aSrcMs: w.aEnd + (w.w0Ms - w.cutMs), bSrcMs: w.bStart + (w.w0Ms - w.cutMs) }
    }
  }
  return { kf, cut, upcoming }
}

/** Export renders whole frames: sample the composite at the frame the playhead is in. */
function frameTime(outMs: number, w: { w0Ms: number }): number {
  const fm = 1000 / 30
  return w.w0Ms + Math.floor((outMs - w.w0Ms) / fm + 1e-6) * fm
}

export type BrollFrame = {
  /** per item: wrapper style (null = hidden), dip colour under it */
  items: Record<string, { box: FrameStyle | null; dip: { opacity: number; background: string } }>
  /** style for the main composite when an item enters / leaves over it */
  under: FrameStyle
}

export function brollFrame(edits: ClipEditsV2, outMs: number, boxW: number): BrollFrame {
  const items = [...(edits.broll ?? [])].sort((a, b) => a.startMs - b.startMs)
  const wins = brollTransitionWindows(items)
  const out: BrollFrame = { items: {}, under: { ...NONE } }
  const active = new Map<string, BrollWindow>()
  for (const w of wins) if (outMs >= w.w0Ms && outMs < w.w1Ms) active.set(`${w.itemId}|${w.kind}`, w)
  for (const it of items) {
    const [s, e] = brollVisibleRange(it, wins)
    out.items[it.id] = { box: null, dip: { opacity: 0, background: 'transparent' } }
    if (!(outMs >= s && outMs < e)) continue
    const target = `broll:${it.id}` as const
    const kf0 = layerTransformAt(edits, target, outMs - it.startMs)
    // G3b: in / out / loop preset on top of the keyframes (export: motion.layer_motion_chain).
    const an = layerAnimAt(it, outMs - it.startMs)
    const kfT = an === LAYER_ANIM_IDENTITY
      ? kf0
      : { x: kf0.x + an.dx, y: kf0.y + an.dy, scale: kf0.scale * an.sc, rotation: kf0.rotation + an.rot, opacity: kf0.opacity * an.op }
    out.items[it.id]!.box = {
      ...NONE,
      transform: join(keyframeTransform(kfT), flipCss(layerFlip(edits, target))),
      opacity: kfT.opacity / 100,
      clipPath: cropClipPath(layerCropAt(edits, target, outMs - it.startMs)),
    }
  }
  for (const w of active.values()) {
    const item = items.find((i) => i.id === w.itemId) as BrollItem
    const f = transitionFrame(w.type, progressIn(w, frameTime(outMs, w)))
    // Entering ('in' / 'between'): the item is B (top). Leaving ('out'): the item is A (top).
    const itemIsA = w.kind === 'out'
    const css = compositeCss(f, itemIsA, boxW)
    const top = itemIsA ? css.a : css.b
    const bottom = itemIsA ? css.b : css.a
    const slot = out.items[item.id]!
    if (slot.box) {
      slot.box = {
        transform: join(top.transform, slot.box.transform),
        opacity: slot.box.opacity * top.opacity,
        // Transition clips are screen-space: un-mirror them on a flipped item, then add the crop.
        clipPath: intersectClipPaths(slot.box.clipPath, mirrorClipPath(top.clipPath, layerFlip(edits, `broll:${item.id}`))),
        filter: top.filter,
        visibility: top.visibility,
        ...(top.mask ? { mask: top.mask } : {}),
      }
    }
    slot.dip = css.color
    // The bottom side: the previous item for 'between', else the main composite.
    const prevSlot = w.kind === 'between' && w.fromId ? out.items[w.fromId] : null
    const bottomStyle: FrameStyle = {
      transform: bottom.transform,
      opacity: 1,
      clipPath: bottom.clipPath,
      filter: bottom.filter,
      visibility: 'visible',
    }
    if (prevSlot?.box) {
      prevSlot.box = {
        ...bottomStyle,
        transform: join(bottom.transform, prevSlot.box.transform),
        opacity: prevSlot.box.opacity,
        clipPath: intersectClipPaths(
          prevSlot.box.clipPath,
          mirrorClipPath(bottom.clipPath, layerFlip(edits, `broll:${w.fromId}`)),
        ),
      }
    } else if (!prevSlot) {
      out.under = bottomStyle
    }
  }
  return out
}

/** ASS \fad(180,220) of the hook title as a 0..1 multiplier (hook_overlay.hook_fade_at). */
export function hookFadeAt(tMs: number, durationMs: number): number {
  if (tMs < HOOK_FADE_IN_MS) return Math.max(0, tMs / HOOK_FADE_IN_MS)
  if (tMs > durationMs - HOOK_FADE_OUT_MS) return Math.max(0, (durationMs - tMs) / HOOK_FADE_OUT_MS)
  return 1
}

export function hookFrame(edits: ClipEditsV2, outMs: number): FrameStyle | null {
  const ho = edits.hookOverlay
  if (!ho?.enabled || !ho.text?.trim()) return null
  const dur = Math.max(1500, Math.min(5000, ho.durationMs ?? 2500))
  if (outMs < 0 || outMs >= dur) return null
  const t = layerTransformAt(edits, 'text', outMs)
  return {
    ...NONE,
    transform: keyframeTransform(t),
    opacity: Math.max(0, Math.min(1, (t.opacity / 100) * hookFadeAt(outMs, dur))),
  }
}

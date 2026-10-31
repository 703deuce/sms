/**
 * G1b3: Vegas-style auto-crossfade. When an item on an overlay (B-roll), text or audio (SFX) track is
 * dragged so it overlaps another item on the SAME track, the overlap becomes a crossfade made of
 * envelope keyframes (the G1b1 rubber bands — opacity / volume keyframes, rendered by motion.py /
 * the SFX volume expression and previewed by the same keyframe evaluation, so preview = export):
 *  - visual: the TOP item of the pair (stack order) fades 0 → 100 % opacity over the overlap if it is
 *    the incoming one, or 100 → 0 % if it is the outgoing one; the lower item stays fully visible.
 *  - SFX: the outgoing cue's volume 100 → 0 %, the incoming cue's 0 → 100 % (equal-length linear).
 * Moving the items apart again removes the fade points it made (same times / values), so the drag is
 * reversible; points the user set elsewhere are kept. Manual (toolbar toggle), no AI.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { buildTimelineItems, type ItemRef, type TimelineItem } from '@/lib/clips/editor/clip-timeline'
import { findTrack, targetForItem } from '@/lib/clips/editor/keyframes'
import { orderedStack } from '@/lib/clips/editor/layer-props'
import type { KeyPoint, KeyProp, KeyframeTarget } from '@/lib/clips/editor/motion-schema'

export const XFADE_MIN_MS = 40
const LANES = ['broll', 'text', 'sfx'] as const
type XLane = (typeof LANES)[number]

type Pair = { lane: XLane; a: TimelineItem; b: TimelineItem; ov: number }

function pairsOf(edits: ClipEditsV2, lanes: Record<string, TimelineItem[]>, ids: Set<string>): Pair[] {
  const out: Pair[] = []
  for (const lane of LANES) {
    const items = (lanes[lane] ?? []).filter((x) => x.id !== 'hook')
    for (const a of items) {
      for (const b of items) {
        if (a === b || (a.track ?? '') !== (b.track ?? '')) continue
        if (!ids.has(`${lane}:${a.id}`) && !ids.has(`${lane}:${b.id}`)) continue
        // a outgoing, b incoming: partial overlap only (containment is a layering choice, not a fade).
        if (!(a.startMs < b.startMs && b.startMs < a.endMs && a.endMs < b.endMs)) continue
        const ov = Math.min(a.endMs - b.startMs, b.endMs - b.startMs, a.endMs - a.startMs)
        if (ov >= XFADE_MIN_MS) out.push({ lane, a, b, ov: Math.round(ov) })
      }
    }
  }
  return out
}

type Fade = { target: KeyframeTarget; prop: KeyProp; pts: [KeyPoint, KeyPoint] }

/** The keyframe points a pair's crossfade consists of (local ms of each target). */
function fadesFor(edits: ClipEditsV2, p: Pair): Fade[] {
  const ta = targetForItem(p.lane, p.a.id)
  const tb = targetForItem(p.lane, p.b.id)
  if (!ta || !tb) return []
  const lenA = Math.round(p.a.endMs - p.a.startMs)
  const fadeOutA: Fade = { target: ta, prop: p.lane === 'sfx' ? 'volume' : 'opacity', pts: [{ tMs: lenA - p.ov, v: 100 }, { tMs: lenA, v: 0 }] }
  const fadeInB: Fade = { target: tb, prop: p.lane === 'sfx' ? 'volume' : 'opacity', pts: [{ tMs: 0, v: 0 }, { tMs: p.ov, v: 100 }] }
  if (p.lane === 'sfx') return [fadeOutA, fadeInB]
  const kind = p.lane === 'broll' ? 'broll' : 'text'
  const stack = orderedStack(edits, kind, [p.a, p.b])
  return [stack[stack.length - 1]!.id === p.b.id ? fadeInB : fadeOutA]
}

function same(a: KeyPoint, b: KeyPoint): boolean {
  return Math.abs(a.tMs - b.tMs) <= 1 && Math.abs(a.v - b.v) < 0.01
}

function setPoints(edits: ClipEditsV2, target: KeyframeTarget, prop: KeyProp, points: KeyPoint[]): ClipEditsV2 {
  const tr = findTrack(edits, target, prop)
  const rest = (edits.keyframes ?? []).filter((k) => !(k.target === target && k.prop === prop))
  const keep = points.length || (tr?.value != null && tr.value !== 100)
  const list = keep ? [...rest, { target, prop, ...(tr?.value != null ? { value: tr.value } : {}), points }] : rest
  return { ...edits, keyframes: list.length ? list : undefined }
}

function removeFade(edits: ClipEditsV2, f: Fade): ClipEditsV2 {
  const tr = findTrack(edits, f.target, f.prop)
  if (!tr || !f.pts.every((p) => tr.points.some((q) => same(p, q)))) return edits
  return setPoints(edits, f.target, f.prop, tr.points.filter((q) => !f.pts.some((p) => same(p, q))))
}

function addFade(edits: ClipEditsV2, f: Fade): ClipEditsV2 {
  const tr = findTrack(edits, f.target, f.prop)
  const [lo, hi] = [f.pts[0].tMs, f.pts[1].tMs]
  const kept = (tr?.points ?? []).filter((q) => q.tMs < lo - 1 || q.tMs > hi + 1)
  return setPoints(edits, f.target, f.prop, [...kept, ...f.pts].sort((x, y) => x.tMs - y.tMs))
}

/**
 * Apply auto-crossfades after `refs` were moved / trimmed from `prev` to `next`. `sfxDurationsMs`
 * gives SFX lengths (the timeline knows them from the decoded cues).
 */
export function autoCrossfade(
  prev: ClipEditsV2,
  next: ClipEditsV2,
  previewPrev: ClipEditsV2,
  previewNext: ClipEditsV2,
  refs: readonly ItemRef[],
  sfxDurationsMs?: Record<string, number>,
): ClipEditsV2 {
  const ids = new Set(refs.filter((r) => (LANES as readonly string[]).includes(r.lane)).map((r) => `${r.lane}:${r.id}`))
  if (!ids.size) return next
  const before = pairsOf(prev, buildTimelineItems({ edits: prev, previewEdits: previewPrev, sfxDurationsMs }), ids)
  const after = pairsOf(next, buildTimelineItems({ edits: next, previewEdits: previewNext, sfxDurationsMs }), ids)
  const key = (p: Pair) => `${p.lane}:${p.a.id}|${p.b.id}|${p.ov}`
  const afterKeys = new Set(after.map(key))
  let out = next
  // Old fades (from the previous overlap, measured on prev) go — matched by exact points.
  for (const p of before) if (!afterKeys.has(key(p))) for (const f of fadesFor(prev, p)) out = removeFade(out, f)
  const beforeKeys = new Set(before.map(key))
  for (const p of after) if (!beforeKeys.has(key(p))) for (const f of fadesFor(next, p)) out = addFade(out, f)
  return out
}

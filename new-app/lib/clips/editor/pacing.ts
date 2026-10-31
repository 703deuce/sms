/**
 * G1c pacing checker (Resolve "boring detector" + flash-frame finder). Pure timeline math, no AI:
 *  - static: a stretch longer than N s without a picture change (real cut, camera / source switch,
 *    B-roll or overlay start / end, main-video keyframe such as a punch-in zoom)
 *  - sliver: a kept Video piece of ≤ N frames (leftover from word deletion) → fix: cut it
 *  - gap:    a cut that removes only ≤ N frames (a micro jump) → fix: restore those frames;
 *            (the render drops main-video pieces / cuts under 80 ms, so on Video these are 80 ms+)
 *            a tiny hole between two items on the same overlay / text track → fix: close it
 */
import { mergeCutRanges, type ClipEditsV2 } from '@/lib/clips/edits'
import { realCutIndices, sourceToOutput, type Timebase } from '@/lib/clips/editor/clip-timeline'
import { effectiveTracks, trackIdOf } from '@/lib/clips/editor/tracks'

export const PACING_FPS = 30
export type PacingSettings = { staticMaxS: number; sliverFrames: number; gapFrames: number }
export const DEFAULT_PACING: PacingSettings = { staticMaxS: 8, sliverFrames: 3, gapFrames: 3 }
export const PACING_LIMITS = { staticMaxS: [2, 60], sliverFrames: [1, 6], gapFrames: [1, 6] } as const

export type PacingFlag = {
  id: string
  kind: 'static' | 'sliver' | 'gap'
  /** Output ms. */
  startMs: number
  endMs: number
  label: string
  fix?:
    | { type: 'cutSource'; range: [number, number] }
    | { type: 'restoreSource'; range: [number, number] }
    | { type: 'closeGap'; lane: 'broll' | 'text'; leftId: string; toMs: number }
}

const frameMs = 1000 / PACING_FPS

export function normalizePacing(raw: Partial<PacingSettings> | null | undefined): PacingSettings {
  const c = (v: unknown, [lo, hi]: readonly [number, number], d: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
  }
  return {
    staticMaxS: c(raw?.staticMaxS, PACING_LIMITS.staticMaxS, DEFAULT_PACING.staticMaxS),
    sliverFrames: Math.round(c(raw?.sliverFrames, PACING_LIMITS.sliverFrames, DEFAULT_PACING.sliverFrames)),
    gapFrames: Math.round(c(raw?.gapFrames, PACING_LIMITS.gapFrames, DEFAULT_PACING.gapFrames)),
  }
}

/**
 * `edits` = the user's edits (fixes are written there); `tb` = the time base the timeline draws
 * (from the effective preview edits). Sorted by start.
 */
export function pacingFlags(edits: ClipEditsV2, tb: Timebase, settings: PacingSettings = DEFAULT_PACING): PacingFlag[] {
  const s = normalizePacing(settings)
  const flags: PacingFlag[] = []
  const dur = tb.durationMs
  const sliverMax = s.sliverFrames * frameMs + 0.5
  const gapMax = s.gapFrames * frameMs + 0.5
  // Slivers + micro jumps on the main Video track.
  tb.segs.forEach(([a, b], k) => {
    const len = b - a
    if (len > 0 && len <= sliverMax && tb.segs.length > 1) {
      const n = Math.max(1, Math.round(len / frameMs))
      flags.push({
        id: `sliver:${a}`,
        kind: 'sliver',
        startMs: tb.starts[k]!,
        endMs: tb.starts[k]! + len,
        label: `${n}-frame sliver`,
        fix: { type: 'cutSource', range: [a, b] },
      })
    }
    if (k > 0) {
      const prevEnd = tb.segs[k - 1]![1]
      const jump = a - prevEnd
      if (jump >= 1 && jump <= gapMax) {
        const restorable = (edits.cutRanges ?? []).some(([c0, c1]) => c0 < a && c1 > prevEnd)
        flags.push({
          id: `jump:${prevEnd}`,
          kind: 'gap',
          startMs: tb.starts[k]!,
          endMs: tb.starts[k]!,
          label: `${Math.max(1, Math.round(jump / frameMs))}-frame jump cut`,
          ...(restorable ? { fix: { type: 'restoreSource' as const, range: [prevEnd, a] as [number, number] } } : {}),
        })
      }
    }
  })
  // Tiny holes between items on one overlay / text track.
  const tracks = effectiveTracks(edits)
  const lanes: { lane: 'broll' | 'text'; kind: 'overlay' | 'text'; items: { id: string; startMs: number; endMs: number }[] }[] = [
    { lane: 'broll', kind: 'overlay', items: edits.broll ?? [] },
    { lane: 'text', kind: 'text', items: edits.textItems ?? [] },
  ]
  for (const { lane, kind, items } of lanes) {
    const byTrack = new Map<string, { id: string; startMs: number; endMs: number }[]>()
    for (const it of items) {
      const t = trackIdOf(edits, kind, it.id, tracks)
      byTrack.set(t, [...(byTrack.get(t) ?? []), it])
    }
    for (const list of byTrack.values()) {
      const sorted = [...list].sort((x, y) => x.startMs - y.startMs)
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i]!.startMs - sorted[i - 1]!.endMs
        if (gap >= 1 && gap <= gapMax) {
          flags.push({
            id: `hole:${sorted[i - 1]!.id}`,
            kind: 'gap',
            startMs: sorted[i - 1]!.endMs,
            endMs: sorted[i]!.startMs,
            label: `${Math.max(1, Math.round(gap / frameMs))}-frame gap on the ${lane === 'broll' ? 'overlay' : 'text'} track`,
            fix: { type: 'closeGap', lane, leftId: sorted[i - 1]!.id, toMs: sorted[i]!.startMs },
          })
        }
      }
    }
  }
  // Static stretches: every picture change point on the output timeline.
  const changes = new Set<number>([0, dur])
  for (const k of realCutIndices(tb)) changes.add(tb.starts[k]!)
  for (const seg of edits.sourceSegments ?? []) {
    for (const src of [seg.startMs, seg.endMs]) {
      const o = sourceToOutput(tb, src)
      if (o != null) changes.add(o)
    }
  }
  for (const b of edits.broll ?? []) {
    changes.add(b.startMs)
    changes.add(b.endMs)
  }
  for (const t of edits.keyframes ?? []) if (t.target === 'video' && t.prop !== 'opacity') for (const p of t.points) changes.add(p.tMs)
  const pts = [...changes].filter((t) => t >= 0 && t <= dur).sort((a, b) => a - b)
  for (let i = 1; i < pts.length; i++) {
    const len = pts[i]! - pts[i - 1]!
    if (len > s.staticMaxS * 1000) {
      flags.push({ id: `static:${Math.round(pts[i - 1]!)}`, kind: 'static', startMs: pts[i - 1]!, endMs: pts[i]!, label: `${(len / 1000).toFixed(1)} s without a cut or angle change` })
    }
  }
  return flags.sort((x, y) => x.startMs - y.startMs || x.kind.localeCompare(y.kind))
}

/** One-click fix (slivers / gaps). Static shots have no automatic fix. */
export function fixPacingFlag(edits: ClipEditsV2, flag: PacingFlag): ClipEditsV2 | null {
  const f = flag.fix
  if (!f) return null
  if (f.type === 'cutSource') return { ...edits, cutRanges: mergeCutRanges([...(edits.cutRanges ?? []), f.range]) }
  if (f.type === 'restoreSource') {
    // Restore exactly the dropped frames (subtractRangeFromCuts would also drop short leftovers).
    const [a, b] = f.range
    const out: [number, number][] = []
    for (const [s, e] of edits.cutRanges ?? []) {
      if (e <= a || s >= b) out.push([s, e])
      else {
        if (s < a) out.push([s, a])
        if (e > b) out.push([b, e])
      }
    }
    return { ...edits, cutRanges: out }
  }
  if (f.lane === 'broll') {
    const broll = (edits.broll ?? []).map((b) => (b.id === f.leftId ? { ...b, endMs: f.toMs } : b))
    return { ...edits, broll }
  }
  const textItems = (edits.textItems ?? []).map((t) => (t.id === f.leftId ? { ...t, endMs: f.toMs } : t))
  return { ...edits, textItems }
}

/** Every fixable flag at once (fixes are independent: different ranges / items). */
export function fixAllPacing(edits: ClipEditsV2, flags: readonly PacingFlag[]): ClipEditsV2 | null {
  let next = edits
  let any = false
  for (const fl of flags) {
    const n = fixPacingFlag(next, fl)
    if (n) {
      next = n
      any = true
    }
  }
  return any ? next : null
}

/**
 * G1c takes (Vegas Takes / FCP Auditions): several alternates in one timeline slot, T cycles the
 * active one, only the active take renders. Manual; `takesFromRetakes` is the hook for the
 * existing retake finder (its ranges become a main-video take group instead of being deleted).
 *
 *  - main:  alternates are MAIN SOURCE ranges (e.g. three readings of the hook). The active range
 *           plays; the others are cut. Lives in cutRanges, so the worker needs nothing new. Cuts the
 *           user made inside a take are remembered while it is inactive (`saved`).
 *  - broll: alternates are B-roll items sharing the active item's slot. Inactive items stay in
 *           edits.broll (ids, looks, keyframes survive) and are dropped at render by
 *           applyTrackRender (worker: track_render.py / takes.py) and hidden on the timeline.
 */
import { mergeCutRanges, type ClipEditsV2, type CutRange } from '@/lib/clips/edits'

export type MainTakeGroup = { id: string; kind: 'main'; ranges: [number, number][]; active: number; saved?: [number, number][][] }
export type BrollTakeGroup = { id: string; kind: 'broll'; items: string[]; active: string }
export type TakeGroup = MainTakeGroup | BrollTakeGroup

export const MAX_TAKE_GROUPS = 50
export const MAX_TAKES = 8
export const TAKE_MIN_MS = 100
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/

const int = (v: unknown) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? n : null
}

export function normalizeTakes(raw: unknown, brollIds?: ReadonlySet<string>): TakeGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: TakeGroup[] = []
  const usedIds = new Set<string>()
  const usedItems = new Set<string>()
  const mainRanges: [number, number][] = []
  for (const r of raw) {
    if (out.length >= MAX_TAKE_GROUPS) break
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = typeof o.id === 'string' && ID_RE.test(o.id) && !usedIds.has(o.id) ? o.id : null
    if (!id) continue
    if (o.kind === 'main' && Array.isArray(o.ranges)) {
      const ranges: [number, number][] = []
      const saved: [number, number][][] = []
      const rawSaved = Array.isArray(o.saved) ? o.saved : []
      o.ranges.forEach((x, i) => {
        if (!Array.isArray(x) || ranges.length >= MAX_TAKES) return
        const a = int(x[0])
        const b = int(x[1])
        if (a == null || b == null || a < 0 || b - a < TAKE_MIN_MS) return
        if ([...ranges, ...mainRanges].some(([p, q]) => a < q && b > p)) return
        ranges.push([a, b])
        const sv = Array.isArray(rawSaved[i]) ? (rawSaved[i] as unknown[]) : []
        saved.push(
          sv
            .map((c) => (Array.isArray(c) ? ([int(c[0]), int(c[1])] as [number | null, number | null]) : [null, null]))
            .filter((c): c is [number, number] => c[0] != null && c[1] != null && c[1] > c[0] && c[0] >= a && c[1] <= b)
            .slice(0, 50),
        )
      })
      if (ranges.length < 2) continue
      // Keep take order = as given (take 1, 2, …); active clamps.
      const act = int(o.active)
      const active = act != null && act >= 0 && act < ranges.length ? act : 0
      mainRanges.push(...ranges)
      usedIds.add(id)
      const anySaved = saved.some((s) => s.length)
      out.push({ id, kind: 'main', ranges, active, ...(anySaved ? { saved } : {}) })
    } else if (o.kind === 'broll' && Array.isArray(o.items)) {
      const items: string[] = []
      for (const x of o.items) {
        if (typeof x !== 'string' || usedItems.has(x) || items.includes(x) || items.length >= MAX_TAKES) continue
        if (brollIds && !brollIds.has(x)) continue
        items.push(x)
      }
      if (items.length < 2) continue
      const active = typeof o.active === 'string' && items.includes(o.active) ? o.active : items[0]!
      items.forEach((x) => usedItems.add(x))
      usedIds.add(id)
      out.push({ id, kind: 'broll', items, active })
    }
  }
  return out.length ? out : undefined
}

/** B-roll ids that are inactive takes (not rendered, hidden on the timeline). */
export function inactiveBrollTakeIds(edits: Pick<ClipEditsV2, 'takes'>): Set<string> {
  const out = new Set<string>()
  for (const g of edits.takes ?? []) if (g.kind === 'broll') for (const id of g.items) if (id !== g.active) out.add(id)
  return out
}

/** Render-time: drop inactive B-roll takes. */
export function applyTakes(edits: ClipEditsV2): ClipEditsV2 {
  const off = inactiveBrollTakeIds(edits)
  if (!off.size || !edits.broll?.length) return edits
  return { ...edits, broll: edits.broll.filter((b) => !off.has(b.id)) }
}

export function takeGroupOfBroll(edits: Pick<ClipEditsV2, 'takes'>, id: string): BrollTakeGroup | undefined {
  return (edits.takes ?? []).find((g): g is BrollTakeGroup => g.kind === 'broll' && g.items.includes(id))
}

export function takeGroupAtSource(edits: Pick<ClipEditsV2, 'takes'>, srcMs: number): MainTakeGroup | undefined {
  return (edits.takes ?? []).find(
    (g): g is MainTakeGroup => g.kind === 'main' && g.ranges.some(([a, b]) => srcMs >= a && srcMs < b),
  )
}

/** "Take 2/3" for a timeline label, or null. */
export function takeLabel(edits: Pick<ClipEditsV2, 'takes'>, brollId: string): string | null {
  const g = takeGroupOfBroll(edits, brollId)
  return g ? `Take ${g.items.indexOf(g.active) + 1}/${g.items.length}` : null
}

/** "Take 2/3" when a Video item lies in a main take group's active range. */
export function mainTakeLabel(edits: Pick<ClipEditsV2, 'takes'>, srcIn: number, srcOut: number): string | null {
  for (const g of edits.takes ?? []) {
    if (g.kind !== 'main') continue
    const [a, b] = g.ranges[g.active]!
    if (srcIn < b && srcOut > a) return `Take ${g.active + 1}/${g.ranges.length}`
  }
  return null
}

const newGroupId = (edits: Pick<ClipEditsV2, 'takes'>, prefix: string) => {
  const used = new Set((edits.takes ?? []).map((g) => g.id))
  let n = 1
  while (used.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

// ---------------------------------------------------------------------------
// B-roll takes
// ---------------------------------------------------------------------------

/** Group ≥ 2 B-roll items as takes in the first one's slot (the first is active). */
export function groupBrollTakes(edits: ClipEditsV2, ids: readonly string[]): ClipEditsV2 | null {
  const broll = edits.broll ?? []
  const items = ids.filter((id, i) => ids.indexOf(id) === i && broll.some((b) => b.id === id))
  if (items.length < 2 || items.length > MAX_TAKES) return null
  // An item already in a group leaves it (that group dissolves if < 2 remain).
  const rest = (edits.takes ?? [])
    .map((g) => (g.kind === 'broll' ? { ...g, items: g.items.filter((x) => !items.includes(x)) } : g))
    .filter((g) => g.kind !== 'broll' || g.items.length >= 2)
    .map((g) => (g.kind === 'broll' && !g.items.includes(g.active) ? { ...g, active: g.items[0]! } : g))
  const slot = broll.find((b) => b.id === items[0])!
  const nextBroll = broll.map((b) => (items.includes(b.id) ? { ...b, startMs: slot.startMs, endMs: slot.endMs } : b))
  const g: BrollTakeGroup = { id: newGroupId(edits, 'tk'), kind: 'broll', items, active: items[0]! }
  return { ...edits, broll: nextBroll, takes: [...rest, g] }
}

/** Next / previous take; the new active take takes over the slot (timing around it stays put). */
export function cycleBrollTake(edits: ClipEditsV2, id: string, dir: 1 | -1 = 1): { edits: ClipEditsV2; active: string } | null {
  const g = takeGroupOfBroll(edits, id)
  if (!g) return null
  const i = g.items.indexOf(g.active)
  const next = g.items[(i + dir + g.items.length) % g.items.length]!
  const cur = (edits.broll ?? []).find((b) => b.id === g.active)
  const broll = (edits.broll ?? []).map((b) => (b.id === next && cur ? { ...b, startMs: cur.startMs, endMs: cur.endMs } : b))
  const takes = (edits.takes ?? []).map((x) => (x.id === g.id ? { ...g, active: next } : x))
  return { edits: { ...edits, broll, takes }, active: next }
}

// ---------------------------------------------------------------------------
// Main-video takes
// ---------------------------------------------------------------------------

function clipCuts(cuts: readonly CutRange[], [a, b]: [number, number]): [number, number][] {
  const out: [number, number][] = []
  for (const [s, e] of cuts) {
    const x = Math.max(s, a)
    const y = Math.min(e, b)
    if (y > x) out.push([x, y])
  }
  return out
}

function without(cuts: readonly CutRange[], [a, b]: [number, number]): CutRange[] {
  const out: CutRange[] = []
  for (const [s, e] of cuts) {
    if (e <= a || s >= b) out.push([s, e])
    else {
      if (s < a) out.push([s, a])
      if (e > b) out.push([b, e])
    }
  }
  return out
}

/** cutRanges with take `j` active: the others cut whole, j restored with its remembered cuts. */
function cutsForActive(cuts: readonly CutRange[], g: MainTakeGroup, j: number): { cuts: CutRange[]; saved: [number, number][][] } {
  const saved = g.ranges.map((_, i) => g.saved?.[i] ?? [])
  // Remember the cuts inside the currently active take.
  saved[g.active] = clipCuts(cuts, g.ranges[g.active]!)
  let next = [...cuts]
  g.ranges.forEach((r, i) => {
    if (i !== j) next.push(r)
  })
  next = without(mergeCutRanges(next), g.ranges[j]!)
  next.push(...saved[j]!)
  return { cuts: mergeCutRanges(next), saved: saved.map((s, i) => (i === j ? [] : s)) }
}

/** Group main-source ranges (≥ 2, non-overlapping) as takes; `active` plays. */
export function groupMainTakes(edits: ClipEditsV2, ranges: readonly [number, number][], active = 0): ClipEditsV2 | null {
  const g0 = normalizeTakes([{ id: newGroupId(edits, 'mt'), kind: 'main', ranges, active }])?.[0] as MainTakeGroup | undefined
  if (!g0) return null
  const others = (edits.takes ?? []).filter((g) => g.kind !== 'main' || !g.ranges.some(([a, b]) => g0.ranges.some(([p, q]) => a < q && b > p)))
  // Inactive takes remember the user's own cuts inside them.
  const saved = g0.ranges.map((r, i) => (i === g0.active ? [] : clipCuts(edits.cutRanges ?? [], r)))
  const g: MainTakeGroup = { ...g0, saved }
  const { cuts, saved: sv } = cutsForActive(edits.cutRanges ?? [], g, g.active)
  const grp: MainTakeGroup = { ...g, ...(sv.some((s) => s.length) ? { saved: sv } : { saved: undefined }) }
  if (!grp.saved) delete grp.saved
  return { ...edits, cutRanges: cuts, takes: [...others, grp] }
}

export function cycleMainTake(edits: ClipEditsV2, groupId: string, dir: 1 | -1 = 1): ClipEditsV2 | null {
  const g = (edits.takes ?? []).find((x): x is MainTakeGroup => x.id === groupId && x.kind === 'main')
  if (!g) return null
  const j = (g.active + dir + g.ranges.length) % g.ranges.length
  const { cuts, saved } = cutsForActive(edits.cutRanges ?? [], g, j)
  const ng: MainTakeGroup = { id: g.id, kind: 'main', ranges: g.ranges, active: j, ...(saved.some((s) => s.length) ? { saved } : {}) }
  return { ...edits, cutRanges: cuts, takes: (edits.takes ?? []).map((x) => (x.id === g.id ? ng : x)) }
}

/** Ungroup: B-roll keeps every item visible; main keeps the current cut state. */
export function ungroupTakes(edits: ClipEditsV2, groupId: string): ClipEditsV2 {
  const takes = (edits.takes ?? []).filter((g) => g.id !== groupId)
  return { ...edits, takes: takes.length ? takes : undefined }
}

/**
 * Retake finder hook: each flagged range (the earlier, discarded reading) + the same number of
 * words right after it (the reading that follows) → a main take group, the later one active.
 * Nothing is deleted; T flips between them.
 */
export function takesFromRetakes(
  edits: ClipEditsV2,
  retakes: readonly { startMs: number; endMs: number }[],
  /** Source words, seconds (ClipWord s / e). */
  words: readonly { s: number; e: number }[],
): ClipEditsV2 {
  let next = edits
  for (const r of retakes) {
    const inside = words.filter((w) => w.s * 1000 >= r.startMs && w.e * 1000 <= r.endMs).length
    const after = words.filter((w) => w.s * 1000 >= r.endMs).slice(0, Math.max(1, inside))
    if (!after.length) continue
    const alt: [number, number] = [Math.round(r.endMs), Math.round(after[after.length - 1]!.e * 1000)]
    const g = groupMainTakes(next, [[Math.round(r.startMs), Math.round(r.endMs)], alt], 1)
    if (g) next = g
  }
  return next
}

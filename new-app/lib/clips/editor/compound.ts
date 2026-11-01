import type { ClipEditsV2 } from '@/lib/clips/edits'
import { buildTimelineItems, deleteItems, refKey, trimItem, type ItemRef, type LaneId, type OpCtx, type TimelineItem } from '@/lib/clips/editor/clip-timeline'
import { groupItems, groupOf, type ItemGroup } from '@/lib/clips/editor/item-flags'

export const COMPOUND_LANES: readonly LaneId[] = ['broll', 'text', 'adjust', 'sfx']
type Lanes = Record<LaneId, TimelineItem[]>
export type CompoundGroup = ItemGroup & { compound: { name: string } }
export const isCompound = (g: ItemGroup | null | undefined): g is CompoundGroup => Boolean(g?.compound)
const eligible = (r: ItemRef) => COMPOUND_LANES.includes(r.lane) && !(r.lane === 'text' && r.id === 'hook')

export function nextCompoundName(edits: Pick<ClipEditsV2, 'groups'>): string {
  return `Compound ${(edits.groups ?? []).filter(isCompound).length + 1}`
}

/** Alt+G. rowIndexOf orders members top-row first (items[0] = host). Null = fewer than 2 eligible. */
export function createCompound(
  edits: ClipEditsV2,
  refs: readonly ItemRef[],
  id: string,
  rowIndexOf?: (r: ItemRef) => number,
  name = nextCompoundName(edits),
): ClipEditsV2 | null {
  const elig = refs.filter(eligible)
  const sorted = rowIndexOf ? [...elig].sort((a, b) => rowIndexOf(a) - rowIndexOf(b)) : elig
  const next = groupItems(edits, sorted, id)
  if (!next?.groups) return null
  return { ...next, groups: next.groups.map((g) => (g.id === id ? { ...g, compound: { name } } : g)) }
}

export function uncompound(edits: ClipEditsV2, groupId: string): ClipEditsV2 | null {
  const groups = edits.groups ?? []
  const kept = groups.filter((g) => g.id !== groupId)
  return kept.length === groups.length ? null : { ...edits, groups: kept.length ? kept : undefined }
}

/** The compound the selection is exactly (every ref in it, every member selected), else null. */
export function compoundOfSelection(edits: Pick<ClipEditsV2, 'groups'>, refs: readonly ItemRef[]): CompoundGroup | null {
  if (!refs.length) return null
  const g = groupOf(edits, refs[0]!)
  if (!isCompound(g)) return null
  const keys = new Set(refs.map(refKey))
  return g.items.every((k) => keys.has(k)) && keys.size === g.items.length ? g : null
}

export function membersOf(lanes: Lanes, g: ItemGroup): TimelineItem[] {
  return g.items.flatMap((k) => {
    const i = k.indexOf(':')
    const it = lanes[k.slice(0, i) as LaneId]?.find((x) => x.id === k.slice(i + 1))
    return it ? [it] : []
  })
}

export type CompoundHost = { group: CompoundGroup; startMs: number; endMs: number; count: number }
/** Collapsed view: which members are hidden and which item draws the block (open compound excluded). */
export function compoundView(edits: Pick<ClipEditsV2, 'groups'>, lanes: Lanes, openId: string | null) {
  const hidden = new Set<string>()
  const hosts = new Map<string, CompoundHost>()
  for (const g of edits.groups ?? []) {
    if (!isCompound(g) || g.id === openId) continue
    const ms = membersOf(lanes, g)
    if (!ms.length) continue
    hosts.set(refKey(ms[0]!), { group: g, startMs: Math.min(...ms.map((m) => m.startMs)), endMs: Math.max(...ms.map((m) => m.endMs)), count: ms.length })
    for (const m of ms.slice(1)) hidden.add(refKey(m))
  }
  return { hidden, hosts }
}

/** Block trim: crop the content to [to, end] / [start, to]; never extends; never empties the compound. */
export function trimCompound(ctx: OpCtx, g: ItemGroup, edge: 'start' | 'end', toMs: number): ClipEditsV2 | null {
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits, sfxDurationsMs: ctx.sfxDurationsMs })
  const ms = membersOf(lanes, g)
  if (!ms.length) return null
  const s0 = Math.min(...ms.map((m) => m.startMs))
  const e0 = Math.max(...ms.map((m) => m.endMs))
  const to = Math.round(Math.max(s0, Math.min(e0, toMs)))
  if (edge === 'start' ? to <= s0 : to >= e0) return null
  const drop = ms.filter((m) => (edge === 'start' ? m.endMs <= to : m.startMs >= to))
  if (drop.length === ms.length) return null
  let edits = ctx.edits
  for (const m of ms) {
    if (drop.includes(m)) continue
    if (edge === 'start' ? m.startMs >= to : m.endMs <= to) continue
    edits = trimItem({ ...ctx, edits }, { lane: m.lane, id: m.id }, edge, to) ?? edits
  }
  if (drop.length) edits = deleteItems({ ...ctx, edits }, drop.map((m) => ({ lane: m.lane, id: m.id }))) ?? edits
  return edits === ctx.edits ? null : edits
}

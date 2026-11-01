/**
 * TC1 item flags kept beside the items (so no item schema changes):
 *
 *   edits.disabledItems  — TL-29 activate / deactivate (Shift+E). Ref keys `broll:<id>`, `text:<id>`,
 *                          `sfx:<generationId>`, `adjust:<id>`. A disabled item stays on the timeline
 *                          (dimmed) but is not rendered: applyItemEnable drops it for preview AND
 *                          export (worker timeline_lanes.apply_item_enable, same rule).
 *   edits.groups         — TL-30 group / ungroup (Ctrl+G / Ctrl+Shift+G). Selecting one member
 *                          selects the group, so move / delete / copy act on all of it. Editor-only.
 *
 * Both follow split (children `<id>~…` inherit) and delete (stale keys drop) in reconcileItemFlags.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'

export type ItemGroup = { id: string; items: string[] }

export const ENABLE_LANES = ['broll', 'text', 'sfx', 'adjust'] as const
export type EnableLane = (typeof ENABLE_LANES)[number]
export const GROUP_LANES = ['broll', 'text', 'sfx', 'adjust', 'captions'] as const
export const MAX_DISABLED = 500
export const MAX_GROUPS = 100
export const MAX_GROUP_ITEMS = 100

const KEY_RE = /^(broll|text|sfx|adjust|captions):[A-Za-z0-9_~.:-]{1,128}$/
const GID_RE = /^[A-Za-z0-9_-]{1,40}$/

type Ref = { lane: string; id: string }
const keyOf = (r: Ref) => `${r.lane}:${r.id}`

export function normalizeDisabledItems(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: string[] = []
  for (const k of raw) {
    if (typeof k !== 'string' || !KEY_RE.test(k) || k.startsWith('captions:') || out.includes(k)) continue
    out.push(k)
    if (out.length >= MAX_DISABLED) break
  }
  return out.length ? out : undefined
}

export function normalizeGroups(raw: unknown): ItemGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ItemGroup[] = []
  const claimed = new Set<string>()
  const ids = new Set<string>()
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue
    const o = g as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    if (!GID_RE.test(id) || ids.has(id) || !Array.isArray(o.items)) continue
    const items: string[] = []
    for (const k of o.items) {
      if (typeof k !== 'string' || !KEY_RE.test(k) || claimed.has(k) || items.includes(k)) continue
      items.push(k)
      if (items.length >= MAX_GROUP_ITEMS) break
    }
    if (items.length < 2) continue
    items.forEach((k) => claimed.add(k))
    ids.add(id)
    out.push({ id, items })
    if (out.length >= MAX_GROUPS) break
  }
  return out.length ? out : undefined
}

export function isDisabled(edits: Pick<ClipEditsV2, 'disabledItems'>, r: Ref): boolean {
  return Boolean(edits.disabledItems?.includes(keyOf(r)))
}

export function canToggleEnabled(r: Ref): boolean {
  return (ENABLE_LANES as readonly string[]).includes(r.lane) && !(r.lane === 'text' && r.id === 'hook')
}

/** Shift+E: all eligible refs disabled → enable them; else disable them all. Null = nothing to do. */
export function toggleItemsEnabled(edits: ClipEditsV2, refs: readonly Ref[]): ClipEditsV2 | null {
  const keys = refs.filter(canToggleEnabled).map(keyOf)
  if (!keys.length) return null
  const cur = new Set(edits.disabledItems ?? [])
  const allOff = keys.every((k) => cur.has(k))
  for (const k of keys) {
    if (allOff) cur.delete(k)
    else cur.add(k)
  }
  return { ...edits, disabledItems: normalizeDisabledItems([...cur]) }
}

/** Preview + export: the edits without their disabled items (worker apply_item_enable). */
export function applyItemEnable(edits: ClipEditsV2): ClipEditsV2 {
  const off = new Set(edits.disabledItems ?? [])
  if (!off.size) return edits
  let next: ClipEditsV2 = edits
  if (edits.broll?.some((b) => off.has(`broll:${b.id}`))) next = { ...next, broll: edits.broll.filter((b) => !off.has(`broll:${b.id}`)) }
  if (edits.textItems?.some((t) => off.has(`text:${t.id}`))) {
    const kept = edits.textItems.filter((t) => !off.has(`text:${t.id}`))
    next = { ...next, textItems: kept.length ? kept : undefined }
  }
  if (edits.adjustLayers?.some((l) => off.has(`adjust:${l.id}`))) {
    const kept = edits.adjustLayers.filter((l) => !off.has(`adjust:${l.id}`))
    next = { ...next, adjustLayers: kept.length ? kept : undefined }
  }
  const a = edits.audio
  if (a?.sfx?.some((s) => off.has(`sfx:${s.generationId}`))) next = { ...next, audio: { ...a, sfx: a.sfx.filter((s) => !off.has(`sfx:${s.generationId}`)) } }
  return next
}

// ---- groups --------------------------------------------------------------------------------

export function groupOf(edits: Pick<ClipEditsV2, 'groups'>, r: Ref): ItemGroup | null {
  const k = keyOf(r)
  return edits.groups?.find((g) => g.items.includes(k)) ?? null
}

/** Ctrl+G: one group of the selection (members leave their old groups). Null = fewer than 2. */
export function groupItems(edits: ClipEditsV2, refs: readonly Ref[], id: string): ClipEditsV2 | null {
  const keys = [...new Set(refs.filter((r) => (GROUP_LANES as readonly string[]).includes(r.lane) && !(r.lane === 'text' && r.id === 'hook')).map(keyOf))]
  if (keys.length < 2) return null
  const rest = (edits.groups ?? []).map((g) => ({ ...g, items: g.items.filter((k) => !keys.includes(k)) }))
  return { ...edits, groups: normalizeGroups([...rest, { id, items: keys }]) }
}

/** Ctrl+Shift+G: dissolve every group touching the selection. */
export function ungroupItems(edits: ClipEditsV2, refs: readonly Ref[]): ClipEditsV2 | null {
  const keys = new Set(refs.map(keyOf))
  const groups = edits.groups ?? []
  const kept = groups.filter((g) => !g.items.some((k) => keys.has(k)))
  if (kept.length === groups.length) return null
  return { ...edits, groups: kept.length ? kept : undefined }
}

/** Selection grows to whole groups (click one member → all members). */
export function expandToGroups<R extends Ref>(edits: Pick<ClipEditsV2, 'groups'>, refs: readonly R[], make: (lane: string, id: string) => R): R[] {
  if (!edits.groups?.length) return [...refs]
  const out = [...refs]
  const seen = new Set(refs.map(keyOf))
  for (const r of refs) {
    const g = groupOf(edits, r)
    if (!g) continue
    for (const k of g.items) {
      if (seen.has(k)) continue
      seen.add(k)
      const i = k.indexOf(':')
      out.push(make(k.slice(0, i), k.slice(i + 1)))
    }
  }
  return out
}

// ---- reconcile (split / delete) ------------------------------------------------------------

function spans(e: ClipEditsV2): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>()
  for (const b of e.broll ?? []) m.set(`broll:${b.id}`, [b.startMs, b.endMs])
  for (const t of e.textItems ?? []) m.set(`text:${t.id}`, [t.startMs, t.endMs])
  for (const l of e.adjustLayers ?? []) m.set(`adjust:${l.id}`, [l.startMs, l.endMs])
  for (const l of e.captionLines ?? []) m.set(`captions:${l.id}`, [l.startMs, l.endMs])
  for (const x of e.audio?.sfx ?? []) m.set(`sfx:${x.generationId}`, [x.atMs, x.atMs + (x.durMs ?? 0)])
  return m
}

/**
 * Split children (keys new in `next`, `<lane>:<origin>~…`) inherit the flags of their parent: the
 * item of the same origin that existed before and now ends where the child starts. Stale keys drop.
 */
export function reconcileItemFlags(prev: ClipEditsV2, next: ClipEditsV2): ClipEditsV2 {
  if (!next.disabledItems?.length && !next.groups?.length) return next
  const a = spans(prev)
  const b = spans(next)
  const originOf = (k: string) => k.split('~')[0]!
  const parentOf = new Map<string, string>()
  for (const [k, [s]] of b) {
    if (a.has(k) || !k.includes('~')) continue
    for (const [p, span] of b) {
      if (p === k || !a.has(p) || originOf(p) !== originOf(k)) continue
      const was = a.get(p)!
      if (span[1] === s && was[1] > s && was[0] < s) {
        parentOf.set(k, p)
        break
      }
    }
  }
  let out = next
  if (next.disabledItems?.length) {
    const kept = next.disabledItems.filter((k) => b.has(k))
    for (const [k, p] of parentOf) if (kept.includes(p) && !kept.includes(k)) kept.push(k)
    const norm = normalizeDisabledItems(kept)
    if (JSON.stringify(norm ?? null) !== JSON.stringify(next.disabledItems)) out = { ...out, disabledItems: norm }
  }
  if (next.groups?.length) {
    const groups = next.groups.map((g) => {
      const items = g.items.filter((k) => b.has(k))
      for (const [k, p] of parentOf) if (items.includes(p) && !items.includes(k)) items.push(k)
      return { ...g, items }
    })
    const norm = normalizeGroups(groups)
    if (JSON.stringify(norm ?? null) !== JSON.stringify(next.groups)) out = { ...out, groups: norm }
  }
  return out
}

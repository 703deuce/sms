/**
 * G4cfix: scene split for B-roll items and inserted clips (the Video lane uses videoSplits).
 * Cuts are media times (ms in the item's own file); each one splits the piece that contains it,
 * exactly like the timeline's Split (same ids / anim rules), so the export needs nothing new.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { BROLL_MIN_MS, type BrollItem } from '@/lib/clips/broll'
import { splitAnim } from '@/lib/clips/editor/layer-anim'
import { splitBrollId } from '@/lib/clips/editor/clip-timeline'
import { INSERT_MIN_MS, MAX_INSERTS, type ClipInsert } from '@/lib/clips/editor/inserts'

const origin = (id: string) => id.split('~')[0]

/** Split B-roll item `id` (and the pieces it becomes) at media times `cutsMs`. */
export function splitBrollAtMedia(edits: ClipEditsV2, id: string, cutsMs: readonly number[]): ClipEditsV2 {
  let list = [...(edits.broll ?? [])]
  const root = origin(id)
  for (const m of [...cutsMs].sort((a, b) => a - b)) {
    const idx = list.findIndex((b) => {
      if (origin(b.id) !== root) return false
      const t = b.startMs + (m - (b.inMs ?? 0))
      return t - b.startMs >= BROLL_MIN_MS && b.endMs - t >= BROLL_MIN_MS
    })
    if (idx < 0) continue
    const src = list[idx]!
    const t = Math.round(src.startMs + (m - (src.inMs ?? 0)))
    const left = splitAnim({ ...src, endMs: t } as BrollItem, 'left')
    const right = splitAnim(
      { ...src, id: splitBrollId(src.id, t, list.map((b) => b.id)), startMs: t, inMs: (src.inMs ?? 0) + (t - src.startMs) } as BrollItem,
      'right',
    )
    list = [...list.slice(0, idx), left, right, ...list.slice(idx + 1)]
  }
  return { ...edits, broll: list }
}

/** Split insert `id` into consecutive inserts (same anchor, array order = play order) at media times. */
export function splitInsertAtMedia(edits: ClipEditsV2, id: string, cutsMs: readonly number[]): ClipEditsV2 {
  let list: ClipInsert[] = [...(edits.inserts ?? [])]
  const root = origin(id)
  for (const m0 of [...cutsMs].sort((a, b) => a - b)) {
    if (list.length >= MAX_INSERTS) break
    const m = Math.round(m0)
    const idx = list.findIndex((x) => origin(x.id) === root && m - x.inMs >= INSERT_MIN_MS && x.inMs + x.durMs - m >= INSERT_MIN_MS)
    if (idx < 0) continue
    const src = list[idx]!
    const ids = list.map((x) => x.id)
    let rid = `${root}~${m}`
    for (let n = 2; ids.includes(rid); n++) rid = `${root}~${m}-${n}`
    const left: ClipInsert = { ...src, durMs: m - src.inMs }
    const right: ClipInsert = { ...src, id: rid, inMs: m, durMs: src.inMs + src.durMs - m }
    list = [...list.slice(0, idx), left, right, ...list.slice(idx + 1)]
  }
  return { ...edits, inserts: list }
}

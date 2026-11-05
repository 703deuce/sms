/**
 * TC2: the timeline draws in EXPORT time. Inserts (gaps, freeze frames, inserted clips) are
 * spliced into the export at a base-timeline point and push everything after them right; the
 * lanes now show that: a visible block where the insert plays, later items moved right by its
 * length. Edits stay in base time — this is a pure view mapping (identity with no inserts).
 */
import { insertWindows, type ClipInsert } from './inserts'

export type ExportTimeMap = {
  /** Sorted by base point; `startMs` / `endMs` are the insert's export (display) window. */
  wins: { id: string; baseMs: number; startMs: number; endMs: number; durMs: number; gap: boolean; freeze: boolean; sourceId: string }[]
  /** Total inserted length (ms). */
  totalMs: number
}

export const IDENTITY_TIME_MAP: ExportTimeMap = { wins: [], totalMs: 0 }

export function exportTimeMap(segs: readonly [number, number][], inserts: readonly ClipInsert[] | undefined): ExportTimeMap {
  const ws = insertWindows(segs, inserts)
  if (!ws.length) return IDENTITY_TIME_MAP
  const wins = ws.map((w) => ({
    id: w.id,
    baseMs: w.baseMs,
    startMs: w.startMs,
    endMs: w.endMs,
    durMs: w.durMs,
    gap: Boolean(w.gap),
    freeze: Boolean(w.freeze),
    sourceId: w.sourceId,
  }))
  return { wins, totalMs: wins.reduce((s, w) => s + w.durMs, 0) }
}

/**
 * Base ms → export ms. `edge: 'start'` (item starts, seeks after an insert) counts inserts AT the
 * point (the item plays after them); `'end'` (item ends, the playhead) does not.
 */
export function toExportMs(map: ExportTimeMap, ms: number, edge: 'start' | 'end' = 'start'): number {
  let add = 0
  for (const w of map.wins) {
    if (edge === 'start' ? w.baseMs <= ms : w.baseMs < ms) add += w.durMs
    else break
  }
  return ms + add
}

/**
 * F21: global edit speed changes the visible duration of SOURCE footage, not
 * the length of inserted gaps/stills (which are post-speed export splices).
 * These are inverse mappings for ruler, playhead, clip geometry and hit-tests.
 * Edits remain in their unwarped base-time coordinates.
 */
export function speedDisplayMs(map: ExportTimeMap, baseMs: number, rate: number,
  edge: 'start' | 'end' = 'start'): number {
  const v = Number.isFinite(rate) && rate > 0 ? rate : 1
  return baseMs / v + (toExportMs(map, baseMs, edge) - baseMs)
}

export function speedBaseMs(map: ExportTimeMap, displayMs: number, rate: number,
  spanMs: number): number {
  const v = Number.isFinite(rate) && rate > 0 ? rate : 1
  let inserted = 0
  for (const w of map.wins) {
    const from = w.baseMs / v + inserted
    if (displayMs < from) break
    if (displayMs < from + w.durMs) return Math.max(0, Math.min(spanMs, w.baseMs - 1))
    inserted += w.durMs
  }
  return Math.max(0, Math.min(spanMs, (displayMs - inserted) * v))
}

/** A black/silent gap occupies display time but has no corresponding main-video frame. */
export function gapAtDisplayMs(map: ExportTimeMap, displayMs: number) {
  return map.wins.find(w => w.gap && displayMs >= w.startMs && displayMs < w.endMs) ?? null
}

/** Export ms → base ms; a point inside an insert maps to the insert's base point. */
export function toBaseMs(map: ExportTimeMap, d: number): number {
  let shift = 0
  for (const w of map.wins) {
    if (d < w.startMs) break
    if (d < w.endMs) return w.baseMs
    shift += w.durMs
  }
  return Math.max(0, d - shift)
}

/**
 * TC3 (a): export ms → the base ms to SEEK to. A point on an insert seeks to the insert's start:
 * 1 ms before its base point (the base point itself shows after the insert, i.e. at its end).
 */
export function seekBaseMs(map: ExportTimeMap, d: number, spanMs: number): number {
  const w = map.wins.find((x) => d >= x.startMs && d < x.endMs)
  return Math.max(0, Math.min(spanMs, w ? w.baseMs - 1 : toBaseMs(map, d)))
}

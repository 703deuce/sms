/**
 * G1b2: MANUAL multicam on top of the E5 model (no new schema, no new render path).
 *
 * Angles = the main camera + the clip's video sources (Media panel uploads / Rooms takes). A switch
 * is an E5 `sourceSegment` on a SYNCED angle (media ms = main ms + source.syncMs), so preview
 * (preview-stage source layers) and export (worker media_sources.py) already render it the same
 * way — the shared render plan. Audio sync = the existing MEDIA_SYNC cross-correlation job
 * (`/library/[mediaId]/sync` → source.syncMs); `nudgeSync` is the manual offset on top.
 *
 * Manual segments carry no `auto` flag, so the existing auto-switch (`buildMulticamSegments` /
 * `applyMulticamSegments`, `edits.multicam`) never overwrites them — that is the hook for a later
 * optional "auto-switch to active speaker" pass that fills only the remaining gaps.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  setSourceSegment,
  sourceById,
  sourceSegmentAt,
  upsertSource,
  SOURCE_SEG_MIN_MS,
  type ClipMediaSource,
} from '@/lib/clips/editor/sources'

export const MAIN_ANGLE = 'main'
export const MAX_ANGLES = 9
export const SYNC_NUDGE_MS = 1000 / 30

export type Angle = { key: number; sourceId: string; label: string; synced: boolean }

/**
 * Keys 1–9: 1 = main camera, then the clip's video sources, then synced angles from the project
 * media library that are not on the clip yet (`library`, from media-add.sourceFromItem). The clip's
 * copy wins (it carries the manual sync nudge).
 */
export function multicamAngles(edits: ClipEditsV2, library: readonly ClipMediaSource[] = []): Angle[] {
  const own = (edits.sources ?? []).filter((s) => s.mediaType === 'video')
  const ids = new Set(own.map((s) => s.id))
  const vids = [...own, ...library.filter((s) => s.mediaType === 'video' && s.syncMs !== undefined && !ids.has(s.id))]
  const out: Angle[] = [{ key: 1, sourceId: MAIN_ANGLE, label: 'Main', synced: true }]
  for (const s of vids.slice(0, MAX_ANGLES - 1)) {
    out.push({ key: out.length + 1, sourceId: s.id, label: s.label || `Cam ${out.length + 1}`, synced: s.syncMs !== undefined })
  }
  return out
}

/** Angle shown at main source ms (main when no segment). */
export function angleAt(edits: ClipEditsV2, srcMs: number): string {
  return sourceSegmentAt(edits.sourceSegments, srcMs)?.sourceId ?? MAIN_ANGLE
}

function findSource(edits: ClipEditsV2, sourceId: string, library: readonly ClipMediaSource[]): ClipMediaSource | undefined {
  return sourceById(edits.sources, sourceId) ?? library.find((s) => s.id === sourceId)
}

/** Put the angle on the clip, time-locked to main (syncMs 0 until audio-sync / nudge sets it). */
function ensureSynced(edits: ClipEditsV2, src: ClipMediaSource): ClipMediaSource[] | undefined {
  const own = sourceById(edits.sources, src.id)
  if (own && own.syncMs !== undefined) return edits.sources
  return upsertSource(edits.sources, { ...(own ?? src), syncMs: (own ?? src).syncMs ?? 0 }).sources
}

/** Angle over a main-source span [startMs, endMs) (timeline section / transcript range). */
export function setAngleForRange(
  edits: ClipEditsV2,
  startMs: number,
  endMs: number,
  sourceId: string,
  library: readonly ClipMediaSource[] = [],
): ClipEditsV2 {
  const s = Math.max(edits.trim.in, Math.round(startMs))
  const e = Math.min(edits.trim.out, Math.round(endMs))
  if (e - s < SOURCE_SEG_MIN_MS) return edits
  if (sourceId === MAIN_ANGLE) {
    // G1b3: manual "main" is stored explicitly (placeholder segment, renders as the main picture),
    // so a later auto-switch keeps it like any manual angle.
    return { ...edits, sourceSegments: setSourceSegment(edits.sourceSegments, { id: `mc-${s}`, sourceId: MAIN_ANGLE, startMs: s, endMs: e }, edits.sources) }
  }
  const src = findSource(edits, sourceId, library)
  if (!src || src.mediaType !== 'video') return edits
  const sources = ensureSynced(edits, src)
  const seg = { id: `mc-${s}`, sourceId, startMs: s, endMs: e }
  return { ...edits, sources, sourceSegments: setSourceSegment(edits.sourceSegments, seg, sources) }
}

/**
 * Live switch (keys 1–9 while playing, or at a parked playhead): cut at `srcMs` and hold the angle
 * until the next existing switch point (or trim out). Each later press cuts again, so pressing
 * along with playback records the edit.
 */
export function switchAngleAt(
  edits: ClipEditsV2,
  srcMs: number,
  sourceId: string,
  library: readonly ClipMediaSource[] = [],
): ClipEditsV2 {
  const t = Math.round(srcMs)
  let end = edits.trim.out
  for (const s of edits.sourceSegments ?? []) {
    if (s.startMs > t + SOURCE_SEG_MIN_MS / 2 && s.startMs < end) end = s.startMs
    if (s.startMs <= t && s.endMs > t + SOURCE_SEG_MIN_MS / 2 && s.endMs < end) end = s.endMs
  }
  return setAngleForRange(edits, t, end, sourceId, library)
}

/** Manual sync offset nudge (default one frame at 30 fps) on top of the audio auto-sync. */
export function nudgeSync(
  edits: ClipEditsV2,
  sourceId: string,
  deltaMs: number,
  library: readonly ClipMediaSource[] = [],
): ClipEditsV2 {
  const src = findSource(edits, sourceId, library)
  if (!src || src.mediaType !== 'video') return edits
  const syncMs = Math.round((src.syncMs ?? 0) + deltaMs) // sources store whole ms
  return { ...edits, sources: upsertSource(edits.sources, { ...src, syncMs }).sources }
}

/** Digit key → angle index (1–9), null for anything else / with modifiers. */
export function angleKey(e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }): number | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  return /^[1-9]$/.test(e.key) ? Number(e.key) : null
}

/**
 * OUTPUT-ms range → angle, piece by piece over the keep segments in output order (cuts, reorder
 * and silence trim make one output range several source spans). `segs` / `starts` = Timebase.
 */
export function setAngleForOutputRange(
  edits: ClipEditsV2,
  tb: { segs: [number, number][]; starts: number[] },
  outA: number,
  outB: number,
  sourceId: string,
  library: readonly ClipMediaSource[] = [],
): ClipEditsV2 {
  let next = edits
  tb.segs.forEach(([a, b], i) => {
    const o0 = tb.starts[i]!
    const lo = Math.max(outA, o0)
    const hi = Math.min(outB, o0 + (b - a))
    if (hi - lo >= SOURCE_SEG_MIN_MS) next = setAngleForRange(next, a + (lo - o0), a + (hi - o0), sourceId, library)
  })
  return next
}

/** Reset an angle's offset to the audio auto-sync result (library value). */
export function resetSync(edits: ClipEditsV2, src: ClipMediaSource): ClipEditsV2 {
  if (!sourceById(edits.sources, src.id) || src.syncMs === undefined) return edits
  return { ...edits, sources: upsertSource(edits.sources, { ...src }).sources }
}

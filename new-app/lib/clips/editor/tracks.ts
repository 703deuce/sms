/**
 * G1b: multi-track model (CapCut / Descript). Mirror: worker `clips_worker/tracks.py`
 * (parity: tests/fixtures/g1b_tracks_parity.json, vitest + pytest).
 *
 * `edits.tracks` lists every track of the three free kinds, in LAYER order:
 *   overlay — B-roll / image / video overlays (Video-overlay tracks)
 *   text    — text items (the hook title always lives on the default text track)
 *   audio   — SFX / sound placements
 * Overlay and text tracks share ONE visual stack: array order = bottom → top, so a text track
 * may sit under an overlay track (free layer order across types). The main video is always the
 * bottom of the frame; captions / hook / logo / templates stay above every track.
 *
 * Membership: a track lists its item ids (`items`); an item listed nowhere is on the kind's
 * DEFAULT track (`ov1` / `tx1` / `au1`). Item normalizers are untouched, old saves are unchanged.
 * The default track's mute / hide / lock is `edits.timelineLanes[lane]` (the E2 lane toggles), so
 * a project with only default tracks behaves byte-for-byte like before.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { stackOrder } from '@/lib/clips/editor/motion-schema'
import { normalizeTimelineLanes, type LaneId, type LaneState } from '@/lib/clips/editor/timeline-lane-state'

export type TrackKind = 'overlay' | 'text' | 'audio'
export type Track = {
  id: string
  kind: TrackKind
  name?: string
  locked?: true
  hidden?: true
  muted?: true
  /** G2: solo (audio tracks): while any audio track / lane is soloed, the others are silent. */
  soloed?: true
  items?: string[]
}

export const TRACK_KINDS: readonly TrackKind[] = ['overlay', 'text', 'audio'] as const
export const DEFAULT_TRACK_ID: Record<TrackKind, string> = { overlay: 'ov1', text: 'tx1', audio: 'au1' }
export const TRACK_LANE: Record<TrackKind, 'broll' | 'text' | 'sfx'> = { overlay: 'broll', text: 'text', audio: 'sfx' }
export const LANE_TRACK_KIND: Partial<Record<LaneId, TrackKind>> = { broll: 'overlay', text: 'text', sfx: 'audio' }
export const TRACK_ID_PREFIX: Record<TrackKind, string> = { overlay: 'ov', text: 'tx', audio: 'au' }
export const MAX_TRACKS = 16
export const MAX_VISUAL_TRACKS = 10
export const TRACK_NAME_MAX = 40
const ID_RE = /^[A-Za-z0-9_-]{1,24}$/
const ITEM_RE = /^[A-Za-z0-9_~.:-]{1,128}$/

export const DEFAULT_TRACKS: readonly Track[] = [
  { id: 'ov1', kind: 'overlay' },
  { id: 'tx1', kind: 'text' },
  { id: 'au1', kind: 'audio' },
]

const isVisual = (k: TrackKind) => k !== 'audio'

/** Strict normalizer. Returns undefined when the result is the default layout (nothing to save). */
export function normalizeTracks(raw: unknown): Track[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Track[] = []
  const ids = new Set<string>()
  const claimed: Record<TrackKind, Set<string>> = { overlay: new Set(), text: new Set(), audio: new Set() }
  let visual = 0
  for (const r of raw) {
    if (out.length >= MAX_TRACKS) break
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const kind = o.kind
    if (!ID_RE.test(id) || ids.has(id)) continue
    if (kind !== 'overlay' && kind !== 'text' && kind !== 'audio') continue
    // A default id always carries its own kind.
    const defKind = (Object.keys(DEFAULT_TRACK_ID) as TrackKind[]).find((k) => DEFAULT_TRACK_ID[k] === id)
    if (defKind && defKind !== kind) continue
    if (isVisual(kind) && visual >= MAX_VISUAL_TRACKS) continue
    const t: Track = { id, kind }
    if (typeof o.name === 'string') {
      const name = o.name.replace(/\s+/g, ' ').trim().slice(0, TRACK_NAME_MAX)
      if (name) t.name = name
    }
    if (!defKind) {
      if (o.locked === true) t.locked = true
      if (o.hidden === true && isVisual(kind)) t.hidden = true
      if (o.muted === true && kind === 'audio') t.muted = true
      if (o.soloed === true && kind === 'audio') t.soloed = true
    }
    if (Array.isArray(o.items)) {
      const items: string[] = []
      for (const x of o.items) {
        if (typeof x !== 'string' || !ITEM_RE.test(x) || claimed[kind].has(x)) continue
        claimed[kind].add(x)
        items.push(x)
        if (items.length >= 400) break
      }
      if (items.length && !defKind) t.items = items
    }
    ids.add(id)
    if (isVisual(kind)) visual += 1
    out.push(t)
  }
  // Every kind keeps its default track.
  if (!ids.has('ov1')) {
    if (visual >= MAX_VISUAL_TRACKS) {
      const drop = out.findIndex((t) => isVisual(t.kind) && t.id !== 'tx1')
      if (drop >= 0) out.splice(drop, 1)
    }
    out.unshift({ id: 'ov1', kind: 'overlay' })
  }
  if (!out.some((t) => t.id === 'tx1')) {
    if (out.filter((t) => isVisual(t.kind)).length >= MAX_VISUAL_TRACKS) {
      let drop = -1
      out.forEach((t, i) => {
        if (isVisual(t.kind) && t.id !== 'ov1') drop = i
      })
      if (drop >= 0) out.splice(drop, 1)
    }
    let lastVisual = -1
    out.forEach((t, i) => {
      if (isVisual(t.kind)) lastVisual = i
    })
    out.splice(lastVisual + 1, 0, { id: 'tx1', kind: 'text' })
  }
  if (!out.some((t) => t.id === 'au1')) out.push({ id: 'au1', kind: 'audio' })
  while (out.length > MAX_TRACKS) {
    let drop = -1
    out.forEach((t, i) => {
      if (!(t.id in REV_DEFAULT)) drop = i
    })
    if (drop < 0) break
    out.splice(drop, 1)
  }
  return isDefaultTracks(out) ? undefined : out
}

const REV_DEFAULT: Record<string, TrackKind> = { ov1: 'overlay', tx1: 'text', au1: 'audio' }

function isDefaultTracks(ts: readonly Track[]): boolean {
  if (ts.length !== 3) return false
  return ts.every((t, i) => t.id === DEFAULT_TRACKS[i]!.id && !t.name && !t.items && !t.locked && !t.hidden && !t.muted && !t.soloed)
}

export function effectiveTracks(edits: Pick<ClipEditsV2, 'tracks'>): Track[] {
  return normalizeTracks(edits.tracks) ?? DEFAULT_TRACKS.map((t) => ({ ...t }))
}

export function isDefaultTrackId(id: string): boolean {
  return id in REV_DEFAULT
}

export function trackById(edits: Pick<ClipEditsV2, 'tracks'>, id: string): Track | undefined {
  return effectiveTracks(edits).find((t) => t.id === id)
}

/** The track an item is on (unknown / unlisted → the kind's default track). */
export function trackIdOf(edits: Pick<ClipEditsV2, 'tracks'>, kind: TrackKind, itemId: string, tracks?: Track[]): string {
  for (const t of tracks ?? effectiveTracks(edits)) if (t.kind === kind && t.items?.includes(itemId)) return t.id
  return DEFAULT_TRACK_ID[kind]
}

/** Overlay + text tracks, bottom → top. */
export function visualStack(edits: Pick<ClipEditsV2, 'tracks'>): Track[] {
  return effectiveTracks(edits).filter((t) => isVisual(t.kind))
}

export function tracksOfKind(edits: Pick<ClipEditsV2, 'tracks'>, kind: TrackKind): Track[] {
  return effectiveTracks(edits).filter((t) => t.kind === kind)
}

/** Mute / hide / lock of a track (the default track reads the E2 lane toggles). */
export function trackState(edits: Pick<ClipEditsV2, 'tracks' | 'timelineLanes'>, trackId: string): LaneState {
  const t = trackById(edits, trackId)
  if (!t) return {}
  if (isDefaultTrackId(t.id)) return normalizeTimelineLanes(edits.timelineLanes)?.[TRACK_LANE[t.kind]] ?? {}
  return {
    ...(t.locked ? { locked: true } : {}),
    ...(t.hidden ? { hidden: true } : {}),
    ...(t.muted ? { muted: true } : {}),
    ...(t.soloed ? { soloed: true } : {}),
  }
}

/**
 * Drop items on hidden overlay / text tracks and muted audio tracks (non-default tracks; the default
 * track is handled by the E2 lane toggles in applyTimelineLaneState). Same in `tracks.py`.
 */
export function applyTrackState(edits: ClipEditsV2): ClipEditsV2 {
  const ts = normalizeTracks(edits.tracks)
  if (!ts) return edits
  const off: Record<TrackKind, Set<string>> = { overlay: new Set(), text: new Set(), audio: new Set() }
  for (const t of ts) {
    if (isDefaultTrackId(t.id) || !(t.hidden || t.muted)) continue
    for (const id of t.items ?? []) off[t.kind].add(id)
  }
  let next = edits
  if (off.overlay.size && next.broll?.some((b) => off.overlay.has(b.id))) {
    next = { ...next, broll: next.broll.filter((b) => !off.overlay.has(b.id)) }
  }
  if (off.text.size && next.textItems?.some((t) => off.text.has(t.id))) {
    const kept = next.textItems.filter((t) => !off.text.has(t.id))
    next = { ...next, textItems: kept.length ? kept : undefined }
  }
  if (off.audio.size && next.audio?.sfx.some((s) => off.audio.has(s.generationId))) {
    next = { ...next, audio: { ...next.audio, sfx: next.audio.sfx.filter((s) => !off.audio.has(s.generationId)) } }
  }
  return next
}

/**
 * G2 solo: while any audio unit is soloed (the Voice / Music / SFX lanes, or an extra audio track),
 * every audio unit that is not soloed is treated as muted. Returns edits with those mute flags set,
 * so the existing mute paths (preview + export) do the rest. Same in `timeline_lanes.py`.
 */
export function applyAudioSolo(edits: ClipEditsV2): ClipEditsV2 {
  const lanes = normalizeTimelineLanes(edits.timelineLanes) ?? {}
  const ts = normalizeTracks(edits.tracks)
  const laneSolo = (['voice', 'music', 'sfx'] as const).filter((l) => lanes[l]?.soloed)
  const trackSolo = (ts ?? []).filter((t) => t.kind === 'audio' && !isDefaultTrackId(t.id) && t.soloed)
  if (!laneSolo.length && !trackSolo.length) return edits
  const tl = { ...lanes }
  for (const l of ['voice', 'music', 'sfx'] as const) if (!tl[l]?.soloed) tl[l] = { ...(tl[l] ?? {}), muted: true }
  let next: ClipEditsV2 = { ...edits, timelineLanes: tl }
  if (ts) next = { ...next, tracks: ts.map((t) => (t.kind === 'audio' && !isDefaultTrackId(t.id) && !t.soloed ? { ...t, muted: true as const } : t)) }
  return next
}

/** Items of one kind that sit on the kind's default track (E2 lane toggles apply to these). */
export function onDefaultTrack(edits: Pick<ClipEditsV2, 'tracks'>, kind: TrackKind, itemId: string): boolean {
  return trackIdOf(edits, kind, itemId) === DEFAULT_TRACK_ID[kind]
}

/** Rank of a visual track in the stack (0 = bottom), -1 if not visual. */
export function trackRank(edits: Pick<ClipEditsV2, 'tracks'>, trackId: string): number {
  return visualStack(edits).findIndex((t) => t.id === trackId)
}

/**
 * Bottom → top draw order for overlay or text items: by track (stack order), then the G1a z / time
 * clustering inside each track. One track only → exactly G1a's stackOrder.
 */
export function layerOrder<T extends { id: string; startMs: number; endMs: number }>(
  edits: Pick<ClipEditsV2, 'tracks'>,
  kind: 'overlay' | 'text',
  items: readonly T[],
  zOf: (id: string) => number,
): T[] {
  const tracks = effectiveTracks(edits)
  const stack = tracks.filter((t) => t.kind === kind)
  if (stack.length < 2) return stackOrder(items, zOf)
  const out: T[] = []
  for (const t of stack) out.push(...stackOrder(items.filter((it) => trackIdOf(edits, kind, it.id, tracks) === t.id), zOf))
  return out
}

/** True when items of this kind sit on more than one track (stacking then matters across tracks). */
export function spansTracks(edits: Pick<ClipEditsV2, 'tracks'>, kind: TrackKind, ids: readonly string[]): boolean {
  const tracks = effectiveTracks(edits)
  return new Set(ids.map((id) => trackIdOf(edits, kind, id, tracks))).size > 1
}

/**
 * Text items drawn UNDER some overlay: those on text tracks below the top-most overlay track that
 * holds at least one of `overlayIds` (the B-roll actually composited). The export burns them in the
 * B-roll stage between overlay passes; the rest burn on top as before. Same in `tracks.py`.
 */
export function underTextIds(
  edits: Pick<ClipEditsV2, 'tracks' | 'textItems'>,
  overlayIds: readonly string[],
): string[] {
  const tracks = effectiveTracks(edits)
  const stack = tracks.filter((t) => isVisual(t.kind))
  const used = new Set(overlayIds.map((id) => trackIdOf(edits, 'overlay', id, tracks)))
  let top = -1
  stack.forEach((t, i) => {
    if (t.kind === 'overlay' && used.has(t.id)) top = i
  })
  if (top < 0) return []
  const under = new Set(stack.slice(0, top).filter((t) => t.kind === 'text').map((t) => t.id))
  if (!under.size) return []
  return (edits.textItems ?? []).filter((t) => under.has(trackIdOf(edits, 'text', t.id, tracks))).map((t) => t.id)
}

export type VisualGroup = { kind: 'overlay' | 'text'; trackId: string; ids: string[] }

/**
 * The B-roll stage's passes bottom → top when some text sits under an overlay: consecutive tracks
 * of the same kind merge into one pass. Only up to the top-most used overlay track.
 */
export function underPasses(
  edits: Pick<ClipEditsV2, 'tracks' | 'textItems'>,
  overlayIds: readonly string[],
): VisualGroup[] {
  const under = new Set(underTextIds(edits, overlayIds))
  if (!under.size) return []
  const tracks = effectiveTracks(edits)
  const stack = tracks.filter((t) => isVisual(t.kind))
  const used = new Set(overlayIds.map((id) => trackIdOf(edits, 'overlay', id, tracks)))
  let top = -1
  stack.forEach((t, i) => {
    if (t.kind === 'overlay' && used.has(t.id)) top = i
  })
  const out: VisualGroup[] = []
  for (const t of stack.slice(0, top + 1)) {
    const ids =
      t.kind === 'overlay'
        ? overlayIds.filter((id) => trackIdOf(edits, 'overlay', id, tracks) === t.id)
        : (edits.textItems ?? []).filter((x) => under.has(x.id) && trackIdOf(edits, 'text', x.id, tracks) === t.id).map((x) => x.id)
    if (!ids.length) continue
    const last = out[out.length - 1]
    if (last && last.kind === t.kind) last.ids.push(...ids)
    else out.push({ kind: t.kind as 'overlay' | 'text', trackId: t.id, ids: [...ids] })
  }
  return out
}

// ---------------------------------------------------------------------------
// Track edits (each returns NEW edits; undefined `tracks` when back to defaults)
// ---------------------------------------------------------------------------

function withTracks(edits: ClipEditsV2, tracks: Track[]): ClipEditsV2 {
  const norm = normalizeTracks(tracks)
  return { ...edits, tracks: norm }
}

export function defaultTrackName(t: Pick<Track, 'id' | 'kind'>, tracks: readonly Track[]): string {
  if (isDefaultTrackId(t.id)) return t.kind === 'overlay' ? 'B-roll' : t.kind === 'text' ? 'Text' : 'SFX'
  const n = tracks.filter((x) => x.kind === t.kind).findIndex((x) => x.id === t.id) + 1
  return `${t.kind === 'overlay' ? 'Overlay' : t.kind === 'text' ? 'Text' : 'Audio'} ${n}`
}

export function trackLabel(edits: Pick<ClipEditsV2, 'tracks'>, trackId: string): string {
  const ts = effectiveTracks(edits)
  const t = ts.find((x) => x.id === trackId)
  return t ? t.name || defaultTrackName(t, ts) : ''
}

export function canAddTrack(edits: Pick<ClipEditsV2, 'tracks'>, kind: TrackKind): boolean {
  const ts = effectiveTracks(edits)
  if (ts.length >= MAX_TRACKS) return false
  return kind === 'audio' || ts.filter((t) => isVisual(t.kind)).length < MAX_VISUAL_TRACKS
}

/** Add a track. Visual tracks go on top of the stack (or right above `above`). Returns the new id. */
export function addTrack(
  edits: ClipEditsV2,
  kind: TrackKind,
  opts: { above?: string; name?: string } = {},
): { edits: ClipEditsV2; trackId: string } | null {
  if (!canAddTrack(edits, kind)) return null
  const ts = effectiveTracks(edits)
  let n = 2
  while (ts.some((t) => t.id === `${TRACK_ID_PREFIX[kind]}${n}`)) n++
  const id = `${TRACK_ID_PREFIX[kind]}${n}`
  const t: Track = { id, kind, ...(opts.name ? { name: opts.name.slice(0, TRACK_NAME_MAX) } : {}) }
  const next = ts.slice()
  const anchor = opts.above ? next.findIndex((x) => x.id === opts.above) : -1
  if (anchor >= 0 && isVisual(next[anchor]!.kind) === isVisual(kind)) next.splice(anchor + 1, 0, t)
  else if (isVisual(kind)) {
    let lastVisual = -1
    next.forEach((x, i) => {
      if (isVisual(x.kind)) lastVisual = i
    })
    next.splice(lastVisual + 1, 0, t)
  } else next.push(t)
  return { edits: withTracks(edits, next), trackId: id }
}

/** Remove a non-default track; its items go with it (one undo step brings both back). */
export function removeTrack(edits: ClipEditsV2, trackId: string): ClipEditsV2 | null {
  if (isDefaultTrackId(trackId)) return null
  const ts = effectiveTracks(edits)
  const t = ts.find((x) => x.id === trackId)
  if (!t) return null
  const gone = new Set(t.items ?? [])
  let next: ClipEditsV2 = withTracks(edits, ts.filter((x) => x.id !== trackId))
  if (gone.size) {
    if (t.kind === 'overlay') next = { ...next, broll: (next.broll ?? []).filter((b) => !gone.has(b.id)) }
    if (t.kind === 'text') {
      const kept = (next.textItems ?? []).filter((x) => !gone.has(x.id))
      next = { ...next, textItems: kept.length ? kept : undefined }
    }
    if (t.kind === 'audio' && next.audio) next = { ...next, audio: { ...next.audio, sfx: next.audio.sfx.filter((s) => !gone.has(s.generationId)) } }
  }
  return next
}

export function renameTrack(edits: ClipEditsV2, trackId: string, name: string): ClipEditsV2 | null {
  const ts = effectiveTracks(edits)
  const i = ts.findIndex((x) => x.id === trackId)
  if (i < 0) return null
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, TRACK_NAME_MAX)
  if ((ts[i]!.name ?? '') === clean) return null
  const next = ts.slice()
  next[i] = { ...next[i]!, name: clean || undefined }
  if (!clean) delete next[i]!.name
  return withTracks(edits, next)
}

/** Mute / hide / lock a NON-default track (default tracks use setLaneState). */
export function setTrackFlags(edits: ClipEditsV2, trackId: string, patch: LaneState): ClipEditsV2 | null {
  if (isDefaultTrackId(trackId)) return null
  const ts = effectiveTracks(edits)
  const i = ts.findIndex((x) => x.id === trackId)
  if (i < 0) return null
  const t: Track = { ...ts[i]! }
  for (const k of ['locked', 'hidden', 'muted', 'soloed'] as const) {
    if (!(k in patch)) continue
    if (patch[k]) t[k] = true
    else delete t[k]
  }
  const next = ts.slice()
  next[i] = t
  return withTracks(edits, next)
}

/** Move a track one step up (toward the front) or down in its stack. */
export function moveTrack(edits: ClipEditsV2, trackId: string, dir: 'up' | 'down'): ClipEditsV2 | null {
  const ts = effectiveTracks(edits)
  const i = ts.findIndex((x) => x.id === trackId)
  if (i < 0) return null
  const vis = isVisual(ts[i]!.kind)
  const same = ts.map((t, j) => ({ t, j })).filter((x) => isVisual(x.t.kind) === vis)
  const k = same.findIndex((x) => x.j === i)
  // Visual stack: "up" = toward the top (front). Audio list: "up" = earlier row.
  const step = vis ? (dir === 'up' ? 1 : -1) : dir === 'up' ? -1 : 1
  const other = same[k + step]
  if (!other) return null
  const next = ts.slice()
  next[i] = ts[other.j]!
  next[other.j] = ts[i]!
  return withTracks(edits, next)
}

export function trackMoves(edits: Pick<ClipEditsV2, 'tracks'>, trackId: string): { up: boolean; down: boolean } {
  const ts = effectiveTracks(edits)
  const t = ts.find((x) => x.id === trackId)
  if (!t) return { up: false, down: false }
  const same = ts.filter((x) => isVisual(x.kind) === isVisual(t.kind))
  const k = same.findIndex((x) => x.id === trackId)
  return isVisual(t.kind) ? { up: k < same.length - 1, down: k > 0 } : { up: k > 0, down: k < same.length - 1 }
}

/** Put items (ids of one kind) on a track of that kind. */
export function setItemsTrack(edits: ClipEditsV2, kind: TrackKind, itemIds: readonly string[], trackId: string): ClipEditsV2 | null {
  const ts = effectiveTracks(edits)
  const dest = ts.find((t) => t.id === trackId)
  if (!dest || dest.kind !== kind || !itemIds.length) return null
  const ids = new Set(itemIds)
  let changed = false
  const next = ts.map((t) => {
    if (t.kind !== kind) return t
    const had = t.items ?? []
    let items = had.filter((x) => !ids.has(x))
    if (t.id === trackId && !isDefaultTrackId(t.id)) items = [...items, ...itemIds.filter((x) => !items.includes(x))]
    if (items.length !== had.length || items.some((x, i) => x !== had[i])) changed = true
    const out: Track = { ...t }
    if (items.length) out.items = items
    else delete out.items
    return out
  })
  if (!changed) return null
  return withTracks(edits, next)
}

/**
 * Keep membership in sync with items: split / pasted children inherit their parent's track via
 * `inherit` (child id → parent id), deleted items are dropped from track lists.
 */
export function reconcileTracks(prev: ClipEditsV2, next: ClipEditsV2): ClipEditsV2 {
  const ts = normalizeTracks(next.tracks)
  if (!ts || !ts.some((t) => t.items?.length)) return next
  const live: Record<TrackKind, Set<string>> = {
    overlay: new Set((next.broll ?? []).map((b) => b.id)),
    text: new Set((next.textItems ?? []).map((t) => t.id)),
    audio: new Set((next.audio?.sfx ?? []).map((s) => s.generationId)),
  }
  const prevLive: Record<TrackKind, { id: string; startMs: number; endMs: number }[]> = {
    overlay: (prev.broll ?? []).map((b) => ({ id: b.id, startMs: b.startMs, endMs: b.endMs })),
    text: (prev.textItems ?? []).map((t) => ({ id: t.id, startMs: t.startMs, endMs: t.endMs })),
    audio: [],
  }
  let changed = false
  const out = ts.map((t) => {
    const kept = (t.items ?? []).filter((id) => live[t.kind].has(id))
    if (kept.length !== (t.items ?? []).length) changed = true
    return { ...t, items: kept }
  })
  // Split children (`<id>~…`, new this edit) inherit the parent's track.
  const listed = new Set(out.flatMap((t) => t.items))
  const nextItems: Record<'overlay' | 'text', { id: string; startMs: number }[]> = {
    overlay: next.broll ?? [],
    text: next.textItems ?? [],
  }
  for (const kind of ['overlay', 'text'] as const) {
    const prevIds = new Set(prevLive[kind].map((x) => x.id))
    for (const child of nextItems[kind]) {
      if (prevIds.has(child.id) || listed.has(child.id) || !child.id.includes('~')) continue
      const origin = child.id.split('~')[0]!
      const parent = prevLive[kind].find((x) => x.id.split('~')[0] === origin && x.startMs < child.startMs && child.startMs < x.endMs)
      if (!parent) continue
      const home = out.find((t) => t.kind === kind && t.items.includes(parent.id))
      if (!home) continue
      home.items.push(child.id)
      changed = true
    }
  }
  if (!changed) return next
  return withTracks(
    next,
    out.map((t) => {
      const r: Track = { ...t }
      if (!t.items.length) delete r.items
      return r
    }),
  )
}

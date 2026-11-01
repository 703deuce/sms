/**
 * TC1 (TL-28): timeline markers in the clip editor — M adds / removes a marker at the playhead,
 * Shift+M / Alt+M jump to the next / previous one, each marker has a color, a label and an
 * optional "chapter" flag. Markers sit on OUTPUT ms and follow their content when the EDL changes
 * (rippleAnchoredItems), like text items. Editor-only: the worker ignores them (chapter export into
 * the MP4 is G5); "Copy chapters" gives the YouTube description list today.
 */
export const MARKER_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'] as const
export type MarkerColor = (typeof MARKER_COLORS)[number]
export type Marker = { id: string; ms: number; color: MarkerColor; label?: string; chapter?: true }

export const MAX_MARKERS = 200
export const MARKER_LABEL_MAX = 80
/** Two markers closer than this (one frame at 30 fps) are the same spot (M toggles). */
export const MARKER_HIT_MS = 34

export const MARKER_HEX: Record<MarkerColor, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
}

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/

export function normalizeMarkers(raw: unknown): Marker[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Marker[] = []
  const ids = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const ms = Math.round(Number(o.ms))
    if (!ID_RE.test(id) || ids.has(id) || !Number.isFinite(ms) || ms < 0) continue
    const color = (MARKER_COLORS as readonly string[]).includes(String(o.color)) ? (o.color as MarkerColor) : 'blue'
    const m: Marker = { id, ms, color }
    if (typeof o.label === 'string') {
      const label = o.label.replace(/\s+/g, ' ').trim().slice(0, MARKER_LABEL_MAX)
      if (label) m.label = label
    }
    if (o.chapter === true) m.chapter = true
    ids.add(id)
    out.push(m)
    if (out.length >= MAX_MARKERS) break
  }
  out.sort((a, b) => a.ms - b.ms || a.id.localeCompare(b.id))
  return out.length ? out : undefined
}

export function markerAt(list: readonly Marker[] | undefined, ms: number): Marker | null {
  return (list ?? []).find((m) => Math.abs(m.ms - ms) < MARKER_HIT_MS) ?? null
}

/** M: add a marker at `ms`, or remove the one already there. */
export function toggleMarkerAt(list: readonly Marker[] | undefined, ms: number, id: string, color: MarkerColor = 'blue'): Marker[] | undefined {
  const hit = markerAt(list, ms)
  if (hit) return normalizeMarkers((list ?? []).filter((m) => m.id !== hit.id))
  if ((list?.length ?? 0) >= MAX_MARKERS) return list ? [...list] : undefined
  return normalizeMarkers([...(list ?? []), { id, ms: Math.max(0, Math.round(ms)), color }])
}

export function patchMarker(list: readonly Marker[] | undefined, id: string, patch: Partial<Omit<Marker, 'id'>> | null): Marker[] | undefined {
  if (patch === null) return normalizeMarkers((list ?? []).filter((m) => m.id !== id))
  return normalizeMarkers(
    (list ?? []).map((m) => {
      if (m.id !== id) return m
      const n: Record<string, unknown> = { ...m, ...patch }
      if ('chapter' in patch && !patch.chapter) delete n.chapter
      if ('label' in patch && !patch.label) delete n.label
      return n
    }),
  )
}

/** Next (dir 1) / previous (dir −1) marker strictly past `ms`, or null. */
export function adjacentMarker(list: readonly Marker[] | undefined, ms: number, dir: 1 | -1): Marker | null {
  const ms0 = Math.round(ms)
  const xs = list ?? []
  if (dir > 0) return xs.find((m) => m.ms > ms0 + 1) ?? null
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i]!.ms < ms0 - 1) return xs[i]!
  return null
}

/** Ripple: markers follow their content (same mapping as text items), clamped into [0, dur). */
export function rippleMarkers(list: readonly Marker[], mapStart: (ms: number) => number, durMs: number): Marker[] {
  let changed = false
  const out = list.map((m) => {
    const ms = Math.max(0, Math.min(Math.max(0, durMs - 1), mapStart(m.ms)))
    if (ms === m.ms) return m
    changed = true
    return { ...m, ms }
  })
  return changed ? (normalizeMarkers(out) ?? []) : (list as Marker[])
}

function clock(ms: number, hours: boolean): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return hours ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * YouTube-style chapter list from chapter markers: the first line is always 0:00 (YouTube needs it),
 * chapters closer than 10 s to the previous one are skipped (YouTube's minimum).
 */
export function chapterText(list: readonly Marker[] | undefined, durationMs: number): string {
  const ch = (list ?? []).filter((m) => m.chapter)
  if (!ch.length) return ''
  const hours = durationMs >= 3_600_000
  const rows: { ms: number; label: string }[] = []
  if (ch[0]!.ms >= 10_000) rows.push({ ms: 0, label: 'Intro' })
  for (const m of ch) {
    const ms = rows.length ? m.ms : 0
    if (rows.length && ms - rows[rows.length - 1]!.ms < 10_000) continue
    rows.push({ ms, label: m.label || `Chapter ${rows.length + 1}` })
  }
  return rows.map((r) => `${clock(r.ms, hours)} ${r.label}`).join('\n')
}

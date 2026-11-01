/**
 * TC1 timeline options saved with the clip (edits.timelineOpts; editor behaviour only, never frames):
 *   magnet          TL-08  main-track magnet. On (default) = deleting a main segment closes the gap
 *                          (ripple). Off = the deleted span becomes a black gap clip of the same
 *                          length, so everything after it stays put.
 *   rippleOverlays  TL-14/15 link overlays to the main track. On (default) = B-roll, text, adjust
 *                          layers, sound effects and music move with the cut. Off = they stay at their
 *                          output time (captions, blur regions, keyframes and markers always follow
 *                          the words they belong to).
 */
export type TimelineOpts = { magnet?: false; rippleOverlays?: false }

export function normalizeTimelineOpts(raw: unknown): TimelineOpts | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: TimelineOpts = {}
  if (o.magnet === false) out.magnet = false
  if (o.rippleOverlays === false) out.rippleOverlays = false
  return Object.keys(out).length ? out : undefined
}

export const magnetOn = (o: TimelineOpts | undefined) => o?.magnet !== false
export const rippleOverlaysOn = (o: TimelineOpts | undefined) => o?.rippleOverlays !== false

export function setTimelineOpt(o: TimelineOpts | undefined, key: keyof TimelineOpts, on: boolean): TimelineOpts | undefined {
  const n: Record<string, unknown> = { ...(o ?? {}) }
  if (on) delete n[key]
  else n[key] = false
  return normalizeTimelineOpts(n)
}

/**
 * TC1fix: the main magnet is a per-user editor preference (localStorage, default ON) — it only
 * changes how Delete edits, never the frames, so it is not stored in the clip any more (a stale
 * `timelineOpts.magnet: false` in saved edits is ignored).
 */
export const MAGNET_PREF_KEY = 'transovo.timeline.magnet'
export function readMagnetPref(): boolean {
  try {
    return typeof localStorage === 'undefined' || localStorage.getItem(MAGNET_PREF_KEY) !== '0'
  } catch {
    return true
  }
}
export function writeMagnetPref(on: boolean) {
  try {
    if (on) localStorage.removeItem(MAGNET_PREF_KEY)
    else localStorage.setItem(MAGNET_PREF_KEY, '0')
  } catch {
    /* private mode: session only */
  }
}

/** TC2b (TL-55): timeline body height (px) per user; absent = fit all tracks. */
export const TIMELINE_HEIGHT_KEY = 'transovo.timeline.height'
export const TIMELINE_MIN_H = 96
export function readTimelineHeight(): number | null {
  try {
    const v = Number(globalThis.localStorage?.getItem(TIMELINE_HEIGHT_KEY))
    return Number.isFinite(v) && v >= TIMELINE_MIN_H ? Math.round(v) : null
  } catch {
    return null
  }
}
export function writeTimelineHeight(h: number | null) {
  try {
    if (h == null) globalThis.localStorage?.removeItem(TIMELINE_HEIGHT_KEY)
    else globalThis.localStorage?.setItem(TIMELINE_HEIGHT_KEY, String(Math.round(h)))
  } catch {
    /* private mode */
  }
}

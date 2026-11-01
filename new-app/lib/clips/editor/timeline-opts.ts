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

/**
 * TC2b (TL-56): numeric nudge. "+10" / "-3" = frames (30 fps), "+1.5s" / "-0.25s" = seconds,
 * "+1:02" / "-0:01.5" = m:ss(.f). A sign is required (so a bare number is never mistaken for a
 * position). Returns the signed delta in ms, or null when the text is not a nudge.
 */
export const NUDGE_FPS = 30

export function parseNudge(raw: string): number | null {
  const t = raw.trim().replace(/\s+/g, '').toLowerCase()
  const m = /^([+-])(.+)$/.exec(t)
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const v = m[2]!
  let ms: number
  let r: RegExpExecArray | null
  if ((r = /^(\d+(?:\.\d+)?)s$/.exec(v))) ms = Number(r[1]) * 1000
  else if ((r = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(v))) ms = (Number(r[1]) * 60 + Number(r[2])) * 1000
  else if ((r = /^(\d+)f?$/.exec(v))) ms = (Number(r[1]) * 1000) / NUDGE_FPS
  else return null
  if (!Number.isFinite(ms) || ms <= 0 || ms > 3 * 3600_000) return null
  return sign * Math.round(ms)
}

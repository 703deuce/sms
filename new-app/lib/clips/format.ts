/** Shared clip time formatters (display only). */

export function formatTimecode(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function formatDur(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function relativeTime(from: Date, now = new Date()) {
  const diffSec = Math.round((from.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  const diffHr = Math.round(diffSec / 3600)
  if (Math.abs(diffHr) < 48) return rtf.format(diffHr, 'hour')
  const diffDay = Math.round(diffSec / 86400)
  return rtf.format(diffDay, 'day')
}

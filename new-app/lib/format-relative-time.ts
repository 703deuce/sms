export function formatRelativeTime(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Math.max(0, nowMs - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 14) return `${day}d`
  return new Date(iso).toLocaleDateString()
}

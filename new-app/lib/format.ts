const TZ = 'America/Chicago'
const NOW = Date.UTC(2026, 9, 18, 16, 40)

const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' })
const fullFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatPhone(e164: string) {
  const d = e164.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  return e164
}

export function formatDuration(sec: number) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatWhen(iso: string) {
  const t = new Date(iso).getTime()
  const diffH = (NOW - t) / 3600_000
  if (diffH < 1) return `${Math.max(1, Math.round(diffH * 60))}m ago`
  if (diffH < 12) return `${timeFmt.format(t)}`
  if (diffH < 24 * 6) return `${dateFmt.format(t)}, ${timeFmt.format(t)}`
  return dateFmt.format(t)
}

export function formatFull(iso: string) {
  return fullFmt.format(new Date(iso))
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

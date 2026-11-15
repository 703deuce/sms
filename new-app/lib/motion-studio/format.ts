/** mm:ss for headers and storyboard cards (tabular). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** m:ss for inspector timing ("2:12–2:25"). */
export function formatShortClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function parseShortClock(value: string): number | null {
  const m = /^\s*(\d{1,3}):([0-5]\d)\s*$/.exec(value)
  if (!m) return null
  return (Number(m[1]) * 60 + Number(m[2])) * 1000
}

/** Credits only (hard rule: never currency). */
export function formatMsCredits(credits: number | null | undefined): string {
  if (credits == null) return 'Included'
  return `${credits} credit${credits === 1 ? '' : 's'}`
}

/** Strip anything that looks like a URL query / token before showing an error. */
export function sanitizeMsMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, '[link]')
    .replace(/(token|signature|key|secret)=[^\s&]+/gi, '$1=[hidden]')
    .slice(0, 300)
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const s = Math.round(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

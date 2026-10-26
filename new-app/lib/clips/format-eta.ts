/** Human-readable ETA for processing UI (live countdown friendly). */
export function formatEtaSeconds(sec: number): string {
  if (sec <= 0) return 'any moment'
  if (sec < 60) return `~${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return s > 0 ? `~${m}m ${s}s` : `~${m} min`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `~${h}h ${rm}m` : `~${h}h`
}

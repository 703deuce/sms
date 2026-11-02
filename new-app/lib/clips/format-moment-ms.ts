/** CL-05 moment lane label: m:ss.s (one decimal). */
export function formatMomentMs(ms: number): string {
  const sec = Math.max(0, ms) / 1000
  const m = Math.floor(sec / 60)
  const whole = Math.floor(sec % 60)
  const frac = (sec % 1).toFixed(1).slice(1)
  return `${m}:${String(whole).padStart(2, '0')}${frac}`
}

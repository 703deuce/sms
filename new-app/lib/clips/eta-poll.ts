/** Never let displayed ETA jump up more than 50% between status polls. */
export function clampEtaBetweenPolls(rawSec: number, previousPollSec: number | undefined): number {
  const raw = Math.max(0, Math.round(rawSec))
  if (raw <= 0) return 0
  if (previousPollSec === undefined || previousPollSec <= 0) return raw
  const maxAllowed = Math.round(previousPollSec * 1.5)
  return Math.min(raw, maxAllowed)
}

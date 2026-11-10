/** Informational only. Never charged. Never display as money. */
export function estimateYoutubeVideoCredits(totalSourceMs: number, sourceCount: number): number {
  const totalSourceMinutes = Math.max(0, totalSourceMs) / 60_000
  const extra = Math.max(0, sourceCount - 1) * 2
  return Math.max(1, Math.ceil(totalSourceMinutes / 10) + extra)
}

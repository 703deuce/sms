/** Crossing the out marker should seek back to the in marker while looping.
 * Avoid relying on a short frame delta: suspended tabs and buffered playback may
 * advance the playhead by more than one second in a single notification.
 */
export function shouldWrapLoop(previousMs: number, currentMs: number, range: [number, number] | null, enabled: boolean): boolean {
  if (!enabled || !range) return false
  const [start, end] = range
  return end > start && previousMs >= start && previousMs < end && currentMs >= end && currentMs >= previousMs
}

/** The preview player owns looping even when the timeline is hidden.
 * Use the live output-time clock, not a previous React render tick. A delayed
 * frame may jump past Out by several seconds and must still wrap.
 */
export function loopSeekAtOutput(
  outputMs: number,
  inMs: number | null,
  outMs: number | null,
  enabled: boolean,
  playing: boolean,
): number | null {
  if (!enabled || !playing || inMs == null || outMs == null || outMs <= inMs) return null
  return outputMs >= outMs ? inMs : null
}

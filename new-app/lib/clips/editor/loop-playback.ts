/** Crossing the out marker should seek back to the in marker while looping.
 * Avoid relying on a short frame delta: suspended tabs and buffered playback may
 * advance the playhead by more than one second in a single notification.
 */
export function shouldWrapLoop(previousMs: number, currentMs: number, range: [number, number] | null, enabled: boolean): boolean {
  if (!enabled || !range) return false
  const [start, end] = range
  return end > start && previousMs >= start && previousMs < end && currentMs >= end && currentMs >= previousMs
}

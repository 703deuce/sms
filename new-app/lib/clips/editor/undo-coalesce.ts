/**
 * E4fix: undo coalescing for inspector controls. A burst of changes on ONE control (typing, slider
 * keyboard steps, a native color picker drag, repeated releases) becomes ONE undo step: the first
 * change pushes history, later ones within COALESCE_MS replace the state without a new step.
 * A burst ends after COALESCE_MS idle, on another control, or when the value no longer matches what
 * the burst last wrote (e.g. the user pressed Undo in between).
 */
export const COALESCE_MS = 500

export type CoalesceBurst = { key: string; at: number; sig: string }

/** True = push a new undo step; false = fold into the current burst. */
export function coalescePush(burst: CoalesceBurst | null, key: string, now: number, currentSig: string): boolean {
  if (!burst) return true
  if (burst.key !== key) return true
  if (now - burst.at >= COALESCE_MS) return true
  return burst.sig !== currentSig
}

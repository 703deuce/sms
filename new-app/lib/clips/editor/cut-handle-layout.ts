/**
 * E3fix: cut-transition handle placement on the Video lane.
 *
 * At Fit zoom real cuts can sit ~25 px apart, and the 16 px handle buttons were hard to hit.
 * Every handle gets an invisible hit area of up to CUT_HANDLE_HIT_PX that never overlaps a
 * neighbour on the same row; handles closer than CUT_HANDLE_MIN_GAP_PX alternate between two
 * rows so they never sit on top of each other.
 */
export const CUT_HANDLE_HIT_PX = 24
export const CUT_HANDLE_MIN_GAP_PX = 22
export const CUT_HANDLE_MIN_HIT_PX = 6
/** Vertical offset (px from the lane top) of each row. Row 1 sits just below row 0. */
export const CUT_HANDLE_ROW_TOP_PX: readonly [number, number] = [0, 20]

export type CutHandleSlot = { x: number; row: 0 | 1; hitW: number }

/** `xs` = handle centres in px (any order); slots are returned in the same order. */
export function layoutCutHandles(xs: readonly number[]): CutHandleSlot[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x)
  const rows: (0 | 1)[] = []
  order.forEach((o, k) => {
    const prev = order[k - 1]
    rows[k] = prev && o.x - prev.x < CUT_HANDLE_MIN_GAP_PX && rows[k - 1] === 0 ? 1 : 0
  })
  const out: CutHandleSlot[] = new Array(xs.length)
  order.forEach((o, k) => {
    let gap = Infinity
    for (let j = k - 1; j >= 0; j--) {
      if (rows[j] === rows[k]) {
        gap = Math.min(gap, o.x - order[j]!.x)
        break
      }
    }
    for (let j = k + 1; j < order.length; j++) {
      if (rows[j] === rows[k]) {
        gap = Math.min(gap, order[j]!.x - o.x)
        break
      }
    }
    const hitW = Math.max(CUT_HANDLE_MIN_HIT_PX, Math.min(CUT_HANDLE_HIT_PX, Math.floor(gap)))
    out[o.i] = { x: o.x, row: rows[k]!, hitW }
  })
  return out
}

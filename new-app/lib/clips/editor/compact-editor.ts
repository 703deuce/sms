/** FIX2 R7: compact (Opus-style) clip editor. The timeline is collapsed by default, and the choice persists. */
export const TIMELINE_OPEN_KEY = 'clipEditor.timelineOpen'

type KV = Pick<Storage, 'getItem' | 'setItem'>

export function readTimelineOpen(storage: KV | null | undefined): boolean {
  try {
    return storage?.getItem(TIMELINE_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writeTimelineOpen(storage: KV | null | undefined, open: boolean): void {
  try {
    storage?.setItem(TIMELINE_OPEN_KEY, open ? '1' : '0')
  } catch {
    /* private mode / quota: ignore */
  }
}

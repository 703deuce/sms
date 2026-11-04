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

/** TIMELINE_LAYOUT2: docked tool panel in Timeline view (lg+); default open until the user closes it. */
export const TIMELINE_DOCK_PANEL_OPEN_KEY = 'clipEditor.timelineDockPanelOpen'

export function readTimelineDockPanelOpen(storage: KV | null | undefined): boolean {
  try {
    return storage?.getItem(TIMELINE_DOCK_PANEL_OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeTimelineDockPanelOpen(storage: KV | null | undefined, open: boolean): void {
  try {
    storage?.setItem(TIMELINE_DOCK_PANEL_OPEN_KEY, open ? '1' : '0')
  } catch {
    /* private mode / quota: ignore */
  }
}

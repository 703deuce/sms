/** Descript-class shortcuts (gap-matrix §4 C1 + script-editor §C1). */
export type ShortcutRow = {
  action: string
  mac: string
  win: string
  note?: string
  /** M milestone when action ships; omitted = M1–M6 core */
  milestone?: string
}

export const DESCRIPT_SHORTCUT_ROWS: ShortcutRow[] = [
  { action: 'Play / pause', mac: 'Space', win: 'Space' },
  { action: 'Play from cursor', mac: '⇧Space', win: 'Shift+Space' },
  { action: 'Spot audition', mac: '⇧⌘Space', win: 'Ctrl+Shift+Space', milestone: 'M11' },
  { action: 'Delete (cut)', mac: 'Delete', win: 'Backspace / Delete' },
  { action: 'Ignore', mac: '⌘Delete', win: 'Ctrl+Backspace' },
  { action: 'Restore removed', mac: '⇧Enter', win: 'Shift+Enter' },
  { action: 'Replace with gap', mac: '⇧Delete', win: 'Shift+Backspace' },
  { action: 'Cut / Copy / Paste', mac: '⌘X / ⌘C / ⌘V', win: 'Ctrl+X / C / V' },
  { action: 'Undo / Redo', mac: '⌘Z / ⇧⌘Z', win: 'Ctrl+Z / Ctrl+Shift+Z' },
  { action: 'Select all', mac: '⌘A', win: 'Ctrl+A' },
  { action: 'Find / next / previous', mac: '⌘F / ⌘G / ⇧⌘G', win: 'Ctrl+F / Ctrl+G / Ctrl+Shift+G' },
  { action: 'Find in project', mac: '⇧⌘F', win: 'Ctrl+Shift+F', milestone: 'M7' },
  { action: 'Split at playhead', mac: 'S', win: 'S' },
  { action: 'Marker', mac: '#', win: '#', milestone: 'M12' },
  { action: 'Scene', mac: '/', win: '/', milestone: 'M8' },
  { action: 'Comment', mac: '⇧⌘M', win: 'Ctrl+Shift+M', milestone: 'M13' },
  { action: 'Next / prev marker', mac: '⌥⌘. / ,', win: 'Ctrl+Alt+. / ,', milestone: 'M12' },
  { action: 'Next / prev scene', mac: '⇧⌘. / ,', win: 'Ctrl+Shift+. / ,', milestone: 'M8' },
  { action: 'Timeline zoom in / out', mac: '⌘= / ⌘−', win: 'Ctrl+= / Ctrl+−' },
  { action: 'Toggle timeline', mac: '⌃⌥T or ⇧⌘S', win: 'Ctrl+Alt+T or Ctrl+Shift+S' },
  { action: 'Frame step (timeline focused)', mac: '← / →', win: '← / →' },
  { action: 'J / K / L shuttle', mac: 'J / K / L', win: 'J / K / L' },
  { action: 'Home → start', mac: 'Home', win: 'Home' },
  { action: 'Full video view', mac: '⌘.', win: 'Ctrl+.' },
  { action: 'Shortcuts sheet', mac: '⌘/', win: 'Ctrl+/' },
  { action: 'Action bar', mac: '⌘K', win: 'Ctrl+K', milestone: 'M13' },
  { action: 'Project panel', mac: '⌥⌘C', win: 'Ctrl+Alt+C', milestone: 'M7' },
  { action: 'Media panel', mac: '⌥⌘L', win: 'Ctrl+Alt+L', milestone: 'M10' },
  { action: 'Layout picker', mac: '⌥⌘P', win: 'Ctrl+Alt+P', milestone: 'M9' },
  { action: 'Project access', mac: '⇧⌘A', win: 'Ctrl+Shift+A', milestone: 'M13' },
  { action: 'Copy link', mac: '⌘L', win: 'Ctrl+L', milestone: 'M13' },
  { action: 'Settings', mac: '⌘,', win: 'Ctrl+,' },
  { action: 'Bold / Italic / Highlight', mac: '⌘B / ⌘I / ⇧⌘H', win: 'Ctrl+B / I / Ctrl+Shift+H', milestone: 'M13' },
  { action: 'Range / Slip tool', mac: 'R / Y', win: 'R / Y', milestone: 'M8' },
  { action: 'Duplicate layer', mac: '⌘D', win: 'Ctrl+D', milestone: 'M8' },
  { action: 'Hide / lock layer', mac: '⌥H / ⌥L', win: 'Alt+H / Alt+L', milestone: 'M8' },
  { action: 'Snap to guides', mac: '⇧⌘\'', win: 'Ctrl+Shift+\'', milestone: 'M8' },
  { action: 'Auto-level clip', mac: '⌥⇧⌘L', win: 'Ctrl+Alt+Shift+L', milestone: 'M11' },
  { action: 'Resume follow playhead', mac: 'Esc', win: 'Esc', note: 'When follow is off' },
]

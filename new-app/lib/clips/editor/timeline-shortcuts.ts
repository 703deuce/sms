/**
 * G1b: timeline / player keyboard map, CapCut + Descript style. One table drives the key handler
 * (`timelineCommandFor`) and the shortcuts sheet, so the sheet can't drift from the behaviour.
 */
export type TimelineCommand =
  | 'split'
  | 'delete'
  | 'rippleDeleteRange'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'pasteAttributes'
  | 'duplicate'
  | 'selectAll'
  | 'undo'
  | 'redo'
  | 'markIn'
  | 'markOut'
  | 'clearInOut'
  | 'home'
  | 'end'
  | 'prevEdit'
  | 'nextEdit'
  | 'help'
  | 'nextTake'
  | 'prevTake'
  | 'matchFrame'
  // TC1
  | 'marker'
  | 'nextMarker'
  | 'prevMarker'
  | 'toggleEnabled'
  | 'group'
  | 'ungroup'
  | 'compound'
  | 'uncompound'
  | 'openCompound'
  | 'loop'
  | 'trimStart'
  | 'trimEnd'
  | 'speed'
  | 'export'
  | 'palette'

export type KeyLike = { key: string; code?: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }

/** Map a key press to a timeline command (null = not ours). Text fields are filtered by the caller. */
export function timelineCommandFor(e: KeyLike): TimelineCommand | null {
  const mod = Boolean(e.metaKey || e.ctrlKey)
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (mod) {
    if (k === 'b' && !e.shiftKey) return 'split'
    if (k === 'c' && !e.shiftKey && !e.altKey) return 'copy'
    if (k === 'x' && !e.shiftKey && !e.altKey) return 'cut'
    if (k === 'v' && (e.shiftKey || e.altKey)) return 'pasteAttributes'
    if (k === 'v') return 'paste'
    if (k === 'd' && !e.shiftKey) return 'duplicate'
    if (k === 'a') return 'selectAll'
    if (k === 'z') return e.shiftKey ? 'redo' : 'undo'
    if (k === 'y') return 'redo'
    if (k === '/') return 'help'
    // TC1: group / ungroup, speed, export, command palette.
    if (k === 'g' && !e.altKey) return e.shiftKey ? 'ungroup' : 'group'
    if (k === 'r' && !e.shiftKey && !e.altKey) return 'speed'
    if (k === 'e' && !e.shiftKey && !e.altKey) return 'export'
    if (k === 'k' && !e.shiftKey && !e.altKey) return 'palette'
    return null
  }
  if (e.altKey) {
    if (k === 'x' || e.code === 'KeyX') return 'clearInOut'
    // TC1: Alt+M previous marker, Alt+L loop in–out (by code: macOS Option types other characters).
    if (k === 'm' || e.code === 'KeyM') return 'prevMarker'
    if (k === 'l' || e.code === 'KeyL') return 'loop'
    if (k === 'g' || e.code === 'KeyG') return e.shiftKey ? 'uncompound' : 'compound'
    return null
  }
  if (k === 's') return 'split'
  if (k === 'Delete' || k === 'Backspace') return e.shiftKey ? 'rippleDeleteRange' : 'delete'
  if (k === 'i') return 'markIn'
  if (k === 'o') return 'markOut'
  if (k === 'Home') return 'home'
  if (k === 'End') return 'end'
  if (k === 'ArrowUp') return 'prevEdit'
  if (k === 'ArrowDown') return 'nextEdit'
  if (k === '?') return 'help'
  // G1c: T / Shift+T cycle takes, F = match frame.
  if (k === 't') return e.shiftKey ? 'prevTake' : 'nextTake'
  if (k === 'f' && !e.shiftKey) return 'matchFrame'
  // TC1: M marker (Shift: next), Shift+E activate / deactivate, [ / ] trim to the playhead.
  if (k === 'm') return e.shiftKey ? 'nextMarker' : 'marker'
  if (k === 'e' && e.shiftKey) return 'toggleEnabled'
  if (k === '[' || e.code === 'BracketLeft') return 'trimStart'
  if (k === ']' || e.code === 'BracketRight') return 'trimEnd'
  return null
}

/** J / K / L shuttle (player). */
export function shuttleKey(e: KeyLike): 'j' | 'k' | 'l' | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  const k = e.key.toLowerCase()
  return k === 'j' || k === 'k' || k === 'l' ? k : null
}

export const SHUTTLE_RATES = [1, 2, 4, 8] as const
export function nextShuttleRate(cur: number): number {
  const i = SHUTTLE_RATES.findIndex((r) => r === cur)
  return SHUTTLE_RATES[Math.min(SHUTTLE_RATES.length - 1, i + 1)] ?? 1
}

export type ShortcutRow = { keys: string[]; label: string }
export type ShortcutGroup = { title: string; rows: ShortcutRow[] }

export function shortcutGroups(mac: boolean): ShortcutGroup[] {
  const m = mac ? '⌘' : 'Ctrl'
  return [
    {
      title: 'Playback',
      rows: [
        { keys: ['Space'], label: 'Play / pause' },
        { keys: ['L'], label: 'Play forward (press again: 2× · 4× · 8×)' },
        { keys: ['K'], label: 'Pause' },
        { keys: ['J'], label: 'Play backward (press again: faster)' },
        { keys: ['←', '→'], label: 'Previous / next frame (Shift: 10 frames)' },
        { keys: ['↑', '↓'], label: 'Previous / next edit point' },
        { keys: ['Home', 'End'], label: 'Go to start / end' },
      ],
    },
    {
      title: 'Edit',
      rows: [
        { keys: ['S'], label: 'Split at playhead' },
        { keys: [`${m}+B`], label: 'Split at playhead' },
        { keys: ['Del'], label: 'Delete selected (main video: ripple)' },
        { keys: [`${m}+C`, `${m}+X`, `${m}+V`], label: 'Copy / cut / paste at playhead' },
        { keys: [`${m}+D`], label: 'Duplicate' },
        { keys: [`${m}+Shift+V`], label: 'Paste attributes (style, keyframes, flip, color)' },
        { keys: [`${m}+A`], label: 'Select all' },
        { keys: [`${m}+Z`, `${m}+Shift+Z`], label: 'Undo / redo' },
        { keys: ['Drag'], label: 'Move · up/down to another track · main clips reorder' },
        { keys: ['V', 'R', 'U'], label: 'Tool: select / roll edit / slide (Esc: select)' },
        { keys: ['Alt+drag edge'], label: 'J / L cut: Voice edge = sound only · Video edge = picture only' },
        { keys: ['T', 'Shift+T'], label: 'Next / previous take (selected item or Video at the playhead)' },
        { keys: ['F'], label: 'Match frame: open the source media at this moment' },
        { keys: ['[', ']'], label: 'Trim start / end of the selected item (or the clip under the playhead) to the playhead' },
        { keys: ['Shift+E'], label: 'Deactivate / activate selected (kept on the timeline, not rendered)' },
        { keys: [`${m}+G`, `${m}+Shift+G`], label: 'Group / ungroup selected (click one = select all)' },
        { keys: ['Alt+G', 'Alt+Shift+G'], label: 'Create compound clip / uncompound (double-click opens)' },
        { keys: [`${m}+R`], label: 'Speed of the clip under the playhead' },
      ],
    },
    {
      title: 'Range',
      rows: [
        { keys: ['I', 'O'], label: 'Mark in / out at playhead' },
        { keys: ['Alt+X'], label: 'Clear in / out' },
        { keys: ['Shift+Del'], label: 'Delete in–out range on every unlocked track (ripple)' },
        { keys: ['Alt+L'], label: 'Loop playback between in and out' },
      ],
    },
    {
      title: 'Markers',
      rows: [
        { keys: ['M'], label: 'Add / remove a marker at the playhead' },
        { keys: ['Shift+M', 'Alt+M'], label: 'Next / previous marker' },
        { keys: ['Double-click'], label: 'Edit a marker (label, color, chapter)' },
      ],
    },
    {
      title: 'Timeline',
      rows: [
        { keys: ['+', '-'], label: 'Zoom in / out' },
        { keys: ['0'], label: 'Zoom to fit' },
        { keys: ['N'], label: 'Snapping on / off (Alt while dragging bypasses)' },
        { keys: [`${m}+K`], label: 'Command palette (every command by name)' },
        { keys: [`${m}+E`], label: 'Export' },
        { keys: ['Drag on empty space'], label: 'Box-select items' },
        { keys: ['?', `${m}+/`], label: 'This sheet' },
      ],
    },
  ]
}

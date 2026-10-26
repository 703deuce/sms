import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export type KeyAction = 'enter' | 'tab' | 'shiftTab' | 'backspaceEmpty'

const ENTER_NEXT: Record<ScreenplayElementType, ScreenplayElementType> = {
  sceneHeading: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'sceneHeading',
  shot: 'action',
  general: 'general',
  lyrics: 'lyrics',
  castList: 'castList',
  centered: 'centered',
  actBreak: 'sceneHeading',
}

const TAB_NEXT: Partial<Record<ScreenplayElementType, ScreenplayElementType>> = {
  sceneHeading: 'action',
  action: 'character',
  character: 'transition',
  parenthetical: 'dialogue',
  dialogue: 'parenthetical',
  transition: 'sceneHeading',
  shot: 'action',
}

const PREVIOUS_ON_BACKSPACE: Partial<Record<ScreenplayElementType, ScreenplayElementType>> = {
  action: 'sceneHeading',
  dialogue: 'character',
  parenthetical: 'dialogue',
  transition: 'character',
}

export function nextElementType(
  current: ScreenplayElementType,
  action: KeyAction,
): ScreenplayElementType | 'stay' | 'mergePrev' {
  if (action === 'backspaceEmpty') {
    const prev = PREVIOUS_ON_BACKSPACE[current]
    return prev ?? 'stay'
  }
  if (action === 'enter') return ENTER_NEXT[current]
  if (action === 'tab') return TAB_NEXT[current] ?? 'stay'
  if (action === 'shiftTab') {
    const rev = Object.entries(TAB_NEXT).find(([, v]) => v === current)
    return (rev?.[0] as ScreenplayElementType) ?? 'stay'
  }
  return 'stay'
}

const SCENE_HEADING_RE = /^(INT\.|EXT\.|I\/E|EST\.)/i
const TRANSITION_RE = /[A-Z0-9\s]+ TO:$/

export function autoDetectElementType(text: string, current: ScreenplayElementType): ScreenplayElementType {
  const trimmed = text.trim()
  if (current === 'dialogue' && trimmed.startsWith('(')) return 'parenthetical'
  if (SCENE_HEADING_RE.test(trimmed)) return 'sceneHeading'
  if (TRANSITION_RE.test(trimmed) && trimmed === trimmed.toUpperCase()) return 'transition'
  return current
}

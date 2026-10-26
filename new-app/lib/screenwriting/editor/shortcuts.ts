import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'

export const CMD_ELEMENT_TYPES: ScreenplayElementType[] = [
  'sceneHeading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'shot',
  'general',
]

export function elementTypeForDigit(digit: number): ScreenplayElementType | null {
  if (digit < 1 || digit > 8) return null
  return CMD_ELEMENT_TYPES[digit - 1] ?? null
}

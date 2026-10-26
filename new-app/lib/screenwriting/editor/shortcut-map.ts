import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { elementTypeForDigit } from '@/lib/screenwriting/editor/shortcuts'

export type ShortcutPreset = 'transovo' | 'final-draft'

const FD_DIGITS: Record<number, ScreenplayElementType> = {
  1: 'sceneHeading',
  2: 'action',
  3: 'character',
  4: 'parenthetical',
  5: 'dialogue',
  6: 'transition',
  7: 'shot',
  8: 'general',
}

export function elementForShortcut(
  preset: ShortcutPreset,
  digit: number,
): ScreenplayElementType | null {
  if (preset === 'final-draft') return FD_DIGITS[digit] ?? null
  return elementTypeForDigit(digit)
}

/** Returns digit keys that map to different element types between presets. */
export function shortcutConflicts(a: ShortcutPreset, b: ShortcutPreset): number[] {
  const out: number[] = []
  for (let d = 1; d <= 8; d++) {
    const ea = elementForShortcut(a, d)
    const eb = elementForShortcut(b, d)
    if (ea && eb && ea !== eb) out.push(d)
  }
  return out
}

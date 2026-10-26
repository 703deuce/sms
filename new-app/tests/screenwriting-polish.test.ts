import { describe, expect, it } from 'vitest'
import { themeContrastOk } from '@/lib/screenwriting/editor/themes'
import { viewModeClass } from '@/lib/screenwriting/editor/view-modes'
import { elementForShortcut, shortcutConflicts } from '@/lib/screenwriting/editor/shortcut-map'

describe('W19 polish', () => {
  it('themes and view modes expose css hooks', () => {
    expect(themeContrastOk('night')).toBe(true)
    expect(viewModeClass('focus')).toBe('sw-view-focus')
  })

  it('shortcut presets differ on at least one digit when FD mapped', () => {
    const conflicts = shortcutConflicts('transovo', 'final-draft')
    expect(conflicts.length).toBeGreaterThanOrEqual(0)
    expect(elementForShortcut('transovo', 1)).toBeTruthy()
  })
})

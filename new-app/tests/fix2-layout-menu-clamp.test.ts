import { describe, expect, it } from 'vitest'
import { clampMenuPosition } from '@/lib/clips/editor/menu-position'

describe('FIX2 R4 clampMenuPosition', () => {
  it('keeps the cursor position when the menu fits', () => {
    expect(clampMenuPosition(10, 10, 256, 500, 1920, 1080)).toEqual({ left: 10, top: 10 })
  })
  it('pulls the menu back inside the right / bottom edge', () => {
    expect(clampMenuPosition(1900, 1000, 256, 500, 1920, 1080)).toEqual({ left: 1656, top: 572 })
  })
  it('never goes above / left of the margin, even when taller than the viewport', () => {
    expect(clampMenuPosition(-50, 300, 256, 2000, 1920, 1080)).toEqual({ left: 8, top: 8 })
  })
})

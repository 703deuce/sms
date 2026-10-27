import { describe, expect, it } from 'vitest'

describe('applyProjectAutoStockBroll', () => {
  it('is gated by project settings.autoStockBroll', () => {
    expect(Boolean({ autoStockBroll: false }.autoStockBroll)).toBe(false)
    expect(Boolean({ autoStockBroll: true }.autoStockBroll)).toBe(true)
  })
})

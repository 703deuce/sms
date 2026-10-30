import { describe, expect, it } from 'vitest'
import {
  LEGACY_LAYOUT_MODES,
  T6_TEMPLATES,
  T6_TEMPLATES_BY_ID,
  verticalCoverage,
} from '@/lib/clips/templates/registry'

describe('T6 template registry', () => {
  it('has 21 unique template ids', () => {
    expect(T6_TEMPLATES).toHaveLength(21)
    expect(Object.keys(T6_TEMPLATES_BY_ID)).toHaveLength(21)
  })

  it('panels and bands cover the full canvas height', () => {
    for (const t of T6_TEMPLATES) {
      expect(Math.abs(verticalCoverage(t) - 1)).toBeLessThanOrEqual(0.001)
    }
  })

  it('fallback modes are legacy modes', () => {
    for (const t of T6_TEMPLATES) {
      expect(LEGACY_LAYOUT_MODES.has(t.fallbackMode)).toBe(true)
    }
  })
})

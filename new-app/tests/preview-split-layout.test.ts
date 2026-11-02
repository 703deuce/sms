import { describe, expect, it } from 'vitest'
import { LAYOUT_OPTIONS, layoutOptionDisabled } from '@/lib/clips/layout-options'

describe('preview split layout options', () => {
  it('split layout is beta', () => {
    const split = LAYOUT_OPTIONS.find((o) => o.id === 'split')
    expect(split?.beta).toBe(true)
  })

  it('split stays disabled when reframeV2Enabled is false', () => {
    const split = LAYOUT_OPTIONS.find((o) => o.id === 'split')!
    expect(layoutOptionDisabled(split, { facecamLayout: null, reframeV2Enabled: false, aiExtras: false })).toBe(true)
  })
})

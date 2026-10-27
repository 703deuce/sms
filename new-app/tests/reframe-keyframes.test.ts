import { describe, expect, it } from 'vitest'
import { defaultCropForAspect } from '@/lib/clips/script-editor/reframe-keyframes'

describe('defaultCropForAspect', () => {
  it('uses narrower crop width as aspect gets taller (9:16 widest)', () => {
    expect(defaultCropForAspect('4:5').w).toBe(64)
    expect(defaultCropForAspect('9:16').w).toBe(80)
    expect(defaultCropForAspect('1:1').w).toBe(56)
  })
})

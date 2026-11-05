// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applyMatteAlpha } from '@/components/clips/editor/g4/bg-matte-composite-preview'

describe('E2 real person matte compositing', () => {
  it('keeps bright subject pixels and removes black background pixels', () => {
    const frame = new Uint8ClampedArray([200, 100, 25, 255, 50, 120, 150, 255])
    const matte = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255])
    applyMatteAlpha(frame, matte)
    expect(Array.from(frame)).toEqual([200, 100, 25, 255, 50, 120, 150, 0])
  })

  it('preserves fractional feathered alpha and existing transparency', () => {
    const frame = new Uint8ClampedArray([255, 200, 0, 128, 0, 0, 0, 255])
    const matte = new Uint8ClampedArray([128, 128, 128, 255, 64, 64, 64, 255])
    applyMatteAlpha(frame, matte)
    expect(frame[3]).toBe(64)
    expect(frame[7]).toBe(64)
  })
})

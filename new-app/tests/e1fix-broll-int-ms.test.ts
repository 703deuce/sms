import { describe, expect, it } from 'vitest'
import { BROLL_MIN_MS, brollInsertWindow, clampBrollItem, normalizeBrollItems, toIntMs } from '@/lib/clips/broll'
import { intMsSchema, stockBrollInsertBodySchema } from '@/lib/clips/broll-api-schema'

describe('E1fix bug 1: B-roll insert at a fractional playhead', () => {
  it('rounds the playhead window to integer ms and caps at the clip end', () => {
    // live repro: playhead = video.currentTime * 1000 -> 12345.678…
    expect(brollInsertWindow(12345.678, 30000.4)).toEqual({ startMs: 12346, endMs: 15346 })
    expect(brollInsertWindow(28999.6, 30000.9)).toEqual({ startMs: 29000, endMs: 30000 })
    const w = brollInsertWindow(0.4, 29876.5)
    expect(Number.isInteger(w.startMs) && Number.isInteger(w.endMs)).toBe(true)
  })

  it('toIntMs handles junk', () => {
    expect(toIntMs(1.5)).toBe(2)
    expect(toIntMs(-3)).toBe(0)
    expect(toIntMs(Number.NaN)).toBe(0)
  })

  it('API schema coerces floats / numeric strings instead of "Expected integer, received float"', () => {
    const body = stockBrollInsertBodySchema.parse({ providerId: 'px_1', startMs: 12345.678, endMs: '15345.2' })
    expect(body).toEqual({ providerId: 'px_1', startMs: 12346, endMs: 15345 })
    expect(intMsSchema.parse(3000.49)).toBe(3000)
    expect(() => intMsSchema.parse(-1)).toThrow()
    expect(() => intMsSchema.parse('abc')).toThrow()
    expect(() => intMsSchema.parse(Number.NaN)).toThrow()
  })

  it('the old schema shape really rejected the float (negative control)', async () => {
    const { z } = await import('zod')
    expect(() => z.number().int().min(0).parse(12345.678)).toThrow(/integer/i)
  })

  it('clamp / normalize store integers (timeline drags and saved edits too)', () => {
    const c = clampBrollItem({ id: 'a', source: 'stock', assetId: 's', startMs: 1000.6, endMs: 4000.2 }, 30000.7)
    expect(c.startMs).toBe(1001)
    expect(c.endMs).toBe(4000)
    const n = normalizeBrollItems([{ id: 'b', source: 'stock', assetId: 's', startMs: 29500.5, endMs: 31000 }], 30000.5)
    expect(n[0].startMs).toBe(30000 - BROLL_MIN_MS)
    expect(n[0].endMs).toBe(30000)
  })
})

import { describe, expect, it } from 'vitest'
import {
  defaultEdits,
  displayDurationMs,
  normalizeEdits,
  normalizeEditSpeed,
  outputDurationMs,
} from '@/lib/clips/edits'

describe('speed edits', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 10000 }

  it('whitelist in normalizeEdits', () => {
    expect(normalizeEditSpeed(2)).toBeUndefined()
    expect(normalizeEditSpeed(1.25)).toBe(1.25)
    const edits = normalizeEdits({ ...defaultEdits(bounds), speed: 1.5 }, bounds)
    expect(edits.speed).toBe(1.5)
  })

  it('displayDurationMs scales export label duration', () => {
    const edits = normalizeEdits(
      { ...defaultEdits(bounds), trim: { in: 0, out: 10000 }, speed: 1.25 },
      bounds,
    )
    expect(outputDurationMs(edits)).toBe(10000)
    expect(displayDurationMs(edits)).toBe(8000)
  })
})

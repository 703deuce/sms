import { describe, expect, it } from 'vitest'
import { sampleTemplatePlayback, sampleTemplateTransition, validateTemplatePlayback } from '@/lib/clips/real-video-templates/slot-playback'

describe('Batch 6 opt-in slot-local timing contract', () => {
  const slot = {
    outputFrames: 15,
    sourceInFrame: 30,
    sourceDurationFrames: 100,
    headFrames: 5,
    tailFrames: 5,
    pieces: [
      { kind: 'play' as const, frames: 5, rate: 0.5 },
      { kind: 'hold' as const, frames: 3 },
      { kind: 'play' as const, frames: 7, rate: 2 },
    ],
  }

  it('keeps output duration fixed as source slows, freezes, and accelerates', () => {
    validateTemplatePlayback(slot)
    expect(sampleTemplatePlayback(slot, 0)).toEqual({ outputLocalFrame: 0, mediaFrame: 30, held: false })
    expect(sampleTemplatePlayback(slot, 4).mediaFrame).toBe(32)
    expect(sampleTemplatePlayback(slot, 5)).toEqual({ outputLocalFrame: 5, mediaFrame: 32, held: true })
    expect(sampleTemplatePlayback(slot, 7).mediaFrame).toBe(32)
    expect(sampleTemplatePlayback(slot, 8).mediaFrame).toBe(32.5)
    expect(sampleTemplatePlayback(slot, 14).mediaFrame).toBe(44.5)
  })

  it('refuses implicit source extrapolation and missing frames', () => {
    expect(() => validateTemplatePlayback({ ...slot, outputFrames: 16 })).toThrow('fill output')
    expect(() => validateTemplatePlayback({ ...slot, sourceDurationFrames: 44 })).toThrow('source too short')
    expect(() => sampleTemplatePlayback(slot, 15)).toThrow(RangeError)
    expect(() => validateTemplatePlayback({ ...slot, pieces: [{ kind: 'hold' as const, frames: 15 }], sourceInFrame: 0, headFrames: 5 })).toThrow('head handle')
  })

  it('returns real A/B source frames in centered transitions without shortening authored shots', () => {
    const left = { outputFrames: 15, sourceInFrame: 20, sourceDurationFrames: 80,
      pieces: [{ kind: 'play' as const, frames: 15, rate: 1 }], tailFrames: 5 }
    const right = { outputFrames: 15, sourceInFrame: 20, sourceDurationFrames: 80,
      pieces: [{ kind: 'play' as const, frames: 15, rate: 1 }], headFrames: 5 }
    expect(sampleTemplateTransition(left, right, 0, 6)).toEqual({ outgoingFrame: 32, incomingFrame: 17, mix: 1 / 12 })
    expect(sampleTemplateTransition(left, right, 5, 6)).toEqual({ outgoingFrame: 37, incomingFrame: 22, mix: 11 / 12 })
    expect(left.outputFrames + right.outputFrames).toBe(30)
    expect(() => sampleTemplateTransition(left, { ...right, sourceInFrame: 0, headFrames: 0 }, 0, 6)).toThrow('source handles')
  })

  it('allows half-second shots and repeated source references in any order', () => {
    const a = { outputFrames: 15, sourceInFrame: 10, sourceDurationFrames: 30, pieces: [{ kind: 'play' as const, frames: 15, rate: 1 }] }
    const b = { ...a, sourceInFrame: 2 }
    expect([b, a, b].map(s => sampleTemplatePlayback(s, 14).mediaFrame)).toEqual([16, 24, 16])
  })
})

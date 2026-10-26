import { describe, expect, it } from 'vitest'
import { clipWordsToAbsolute, normalizeTranscriptJson } from '@/lib/server/clips/editor-words'

describe('normalizeTranscriptJson', () => {
  it('accepts faster-whisper word shape', () => {
    const out = normalizeTranscriptJson([{ word: 'hey', start: 1, end: 2, probability: 0.9 }])
    expect(out[0]).toMatchObject({ w: 'hey', s: 1, e: 2 })
  })
})

describe('clipWordsToAbsolute', () => {
  it('shifts clip-relative seconds to absolute source timeline', () => {
    const words = [{ w: 'hi', s: 0, e: 1 }]
    const out = clipWordsToAbsolute(words, 60_000, 90_000)
    expect(out[0].s).toBe(60)
    expect(out[0].e).toBe(61)
  })

  it('leaves already-absolute words unchanged', () => {
    const words = [{ w: 'hi', s: 60, e: 61 }]
    const out = clipWordsToAbsolute(words, 60_000, 90_000)
    expect(out[0].s).toBe(60)
    expect(out[0].e).toBe(61)
  })
})

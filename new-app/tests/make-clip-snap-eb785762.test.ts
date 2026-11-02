import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadSourceWords } from '@/lib/clips/source-words'
import { snapTranscriptSelectionMs } from '@/lib/clips/editor/make-clip-from-transcript'
import { clipWordsToSnapWords, clipEndMisalignedWithSentence, snapClipBoundsMs } from '@/lib/clips/editor/snap-clip-bounds'

const fixturePath = join(process.cwd(), 'tests/fixtures/cleanup-proj-eb785762-transcript-words.json')

/** proj_eb78576237c343bb9017ec19d1447a1f — Make clip on words 16–20 ("definitely…the"). */
describe('Make clip snap proj_eb785762', () => {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8')) as { w: string; s: number; e: number; i: number }[]
  const words = loadSourceWords(raw)
  const rangeStartMs = 0
  const rangeEndMs = Math.round(raw[raw.length - 1]!.e * 1000)

  it('sentence spans use global word indices (clipEndMisalignedWithSentence)', () => {
    const snapWords = clipWordsToSnapWords(raw)
    const endMs = Math.round(raw[22]!.e * 1000) + 250
    expect(clipEndMisalignedWithSentence(endMs, snapWords, rangeStartMs, rangeEndMs)).toBe(false)
  })

  it('snaps selection words 16–20 to the full "So we got…Bills side." sentence', () => {
    const w16 = words[16]!
    const w20 = words[20]!
    const selStart = Math.round(w16.s * 1000)
    const selEnd = Math.round(w20.e * 1000)

    const out = snapTranscriptSelectionMs(selStart, selEnd, words, rangeStartMs, rangeEndMs)

    const sentenceStart = Math.round(words[11]!.s * 1000)
    const sentenceEnd = Math.round(words[22]!.e * 1000) + 250

    expect(out.trimIn).toBe(sentenceStart)
    expect(out.trimOut).toBe(sentenceEnd)
    expect(out.trimOut - out.trimIn).toBeGreaterThanOrEqual(3500)
    expect(out.trimOut - out.trimIn).toBeLessThanOrEqual(4500)
    expect(out.title.toLowerCase()).toContain('bills')
  })
})

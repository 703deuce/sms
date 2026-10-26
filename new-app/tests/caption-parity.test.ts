import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { buildCaptionWords, type CaptionSourceWord } from '@/lib/clips/caption-words'
import type { ClipEditsV2 } from '@/lib/clips/edits'

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'caption_parity.json'), 'utf8'),
) as {
  words: CaptionSourceWord[]
  edits: ClipEditsV2
  expected: ReturnType<typeof buildCaptionWords>
}

describe('caption parity', () => {
  it('matches fixture expected output', () => {
    const out = buildCaptionWords(fixture.words, fixture.edits)
    expect(out).toEqual(fixture.expected)
  })
})

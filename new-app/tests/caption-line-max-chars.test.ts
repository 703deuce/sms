// @vitest-environment node
// @ts-ignore — vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
import {
  CAPTION_LINE_MAX_CHARS,
  captionLinePlainText,
  lineTokens,
  mergeCaptionLineWithNext,
  normalizeCaptionLines,
  tokenSpanChars,
} from '../lib/clips/editor/caption-lines'

function fortyWords(): string[] {
  return Array.from({ length: 40 }, (_, i) => `word${String(i + 1).padStart(2, '0')}`)
}

function allWords(lines: { text: string }[]): string[] {
  return lines
    .flatMap((l) => captionLinePlainText(l.text).split(/\s+/))
    .filter(Boolean)
}

describe('CAPTION_LINE_MAX_CHARS overflow', () => {
  it('splits an oversized cue instead of dropping trailing words', () => {
    const words = fortyWords()
    const text = words.join(' ')
    expect(tokenSpanChars(lineTokens(text))).toBeGreaterThan(CAPTION_LINE_MAX_CHARS)

    const lines = normalizeCaptionLines([{ id: 'long', text, startMs: 0, endMs: 8000 }])
    expect(allWords(lines)).toEqual(words)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines[0]?.id).toBe('long')
    expect(lines[0]?.startMs).toBe(0)
    expect(lines[lines.length - 1]?.endMs).toBe(8000)
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]!.startMs).toBe(lines[i - 1]!.endMs)
    }
    for (const line of lines) {
      const toks = lineTokens(line.text)
      if (toks.length === 1) continue
      expect(tokenSpanChars(toks)).toBeLessThanOrEqual(CAPTION_LINE_MAX_CHARS)
    }
  })

  it('keeps a single word longer than the cap instead of truncating it', () => {
    const word = 'w'.repeat(CAPTION_LINE_MAX_CHARS + 40)
    const lines = normalizeCaptionLines([{ id: 'one', text: word, startMs: 1000, endMs: 2000 }])
    expect(allWords(lines)).toEqual([word])
    expect(lines).toHaveLength(1)
    expect(lines[0]?.startMs).toBe(1000)
    expect(lines[0]?.endMs).toBe(2000)
  })

  it('does not drop words when merging two cues over the cap', () => {
    const left = fortyWords().slice(0, 20).join(' ')
    const right = fortyWords().slice(20).join(' ')
    const merged = mergeCaptionLineWithNext(
      [
        { id: 'a', text: left, startMs: 0, endMs: 4000 },
        { id: 'b', text: right, startMs: 4000, endMs: 8000 },
      ],
      'a',
    )
    expect(allWords(merged)).toEqual(fortyWords())
    const normalized = normalizeCaptionLines(merged)
    expect(allWords(normalized)).toEqual(fortyWords())
    expect(normalized.length).toBeGreaterThan(1)
  })
})

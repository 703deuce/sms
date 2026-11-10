// @vitest-environment node
// @ts-expect-error root tsc does not resolve the new-app vitest install
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

function oneCharOverflowText(): string {
  // 199-char token + space + "z" = 201 visible chars; leftover piece is the 1-char token.
  return `${'a'.repeat(CAPTION_LINE_MAX_CHARS - 1)} z`
}

describe('undersized split pieces are merged, never dropped', () => {
  it('keeps a 1-char overflow on a 4s cue (VQ: 201-char leftover "z")', () => {
    const text = oneCharOverflowText()
    expect(tokenSpanChars(lineTokens(text))).toBe(CAPTION_LINE_MAX_CHARS + 1)
    const lines = normalizeCaptionLines([{ id: 'overflow', text, startMs: 0, endMs: 4000 }])
    expect(allWords(lines)).toEqual(['a'.repeat(CAPTION_LINE_MAX_CHARS - 1), 'z'])
    expect(lines[0]?.startMs).toBe(0)
    expect(lines[lines.length - 1]?.endMs).toBe(4000)
    expect(lines.some((line) => allWords([line]).includes('z'))).toBe(true)
  })

  it('keeps every word when a cue just over 100ms splits (40 words / 150ms)', () => {
    const words = fortyWords()
    const lines = normalizeCaptionLines([{ id: 'short', text: words.join(' '), startMs: 0, endMs: 150 }])
    expect(allWords(lines)).toEqual(words)
    expect(allWords(lines).slice(-12)).toEqual(words.slice(-12))
    expect(lines[0]?.startMs).toBe(0)
    expect(lines[lines.length - 1]?.endMs).toBe(150)
  })

  it('VQ case A: 201-char cue over 4s with a short trailing token does not lose "z"', () => {
    const text = oneCharOverflowText()
    const lines = normalizeCaptionLines([{ id: 'vqA', text, startMs: 0, endMs: 4000 }])
    expect(allWords(lines)).toContain('z')
    expect(allWords(lines)).toEqual(allWords([{ text }]))
    expect(lines[lines.length - 1]?.endMs).toBe(4000)
  })

  it('VQ case B: 40-word cue over 150ms does not lose the last 12 words', () => {
    const words = fortyWords()
    const lines = normalizeCaptionLines([{ id: 'vqB', text: words.join(' '), startMs: 0, endMs: 150 }])
    expect(allWords(lines)).toEqual(words)
    expect(allWords(lines).slice(28)).toEqual(words.slice(28))
    expect(allWords(lines).slice(28)).toEqual([
      'word29', 'word30', 'word31', 'word32', 'word33', 'word34',
      'word35', 'word36', 'word37', 'word38', 'word39', 'word40',
    ])
  })

  it('conserves words: total words in equal total words out for every duration-valid cue', () => {
    const fixtures: { id: string; text: string; startMs: number; endMs: number }[] = [
      { id: 'overflow4s', text: oneCharOverflowText(), startMs: 0, endMs: 4000 },
      { id: 'short150', text: fortyWords().join(' '), startMs: 0, endMs: 150 },
      { id: 'justOver100', text: fortyWords().join(' '), startMs: 0, endMs: 101 },
      { id: 'long8s', text: fortyWords().join(' '), startMs: 0, endMs: 8000 },
      { id: 'oneToken', text: 'w'.repeat(CAPTION_LINE_MAX_CHARS + 40), startMs: 1000, endMs: 2000 },
      { id: 'exact200', text: `${'a'.repeat(100)} ${'b'.repeat(99)}`, startMs: 0, endMs: 4000 },
      { id: 'even201', text: `${'a'.repeat(100)} ${'b'.repeat(100)}`, startMs: 0, endMs: 4000 },
      { id: 'tinyOverflow30s', text: oneCharOverflowText(), startMs: 0, endMs: 30_000 },
    ]
    for (const cue of fixtures) {
      const out = normalizeCaptionLines([cue])
      expect(allWords(out), cue.id).toEqual(allWords([cue]))
      expect(cue.endMs - cue.startMs).toBeGreaterThanOrEqual(100)
    }
    const together = fixtures.map((f, i) => ({ ...f, id: `t${i}`, startMs: i * 40_000, endMs: i * 40_000 + (f.endMs - f.startMs) }))
    expect(allWords(normalizeCaptionLines(together))).toEqual(allWords(together))
  })
})

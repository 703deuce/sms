// @ts-ignore root tsc does not resolve the new-app vitest install
import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '../lib/clips/edits'
import {
  formatCaptionChunk,
  formatCaptionLineText,
  formatCaptionWord,
} from '../lib/clips/caption-case'
import { buildNleCaptionsSrt } from '../lib/clips/export-nle-captions'
import { dispWordsPy, type AssWord } from '../lib/clips/render-plan/captions-ass'

const bounds = { clipStartMs: 0, clipEndMs: 20_000 }

function sentenceEdits(lines: { id: string; text: string; startMs: number; endMs: number }[]): ClipEditsV2 {
  return normalizeEdits(
    {
      ...defaultEdits(bounds),
      captions: { ...defaultEdits(bounds).captions, case: 'sentence' },
      captionLines: lines,
    },
    bounds,
  )
}

function assText(words: AssWord[], caseMode: string): string {
  return dispWordsPy(words, caseMode, false).join(' ')
}

describe('sentence case keeps source casing after the first letter', () => {
  it('capitalizes only the first letter of a cue and keeps the rest', () => {
    expect(formatCaptionWord('early', 'sentence', true)).toBe('Early')
    expect(formatCaptionWord('Early', 'sentence', true)).toBe('Early')
    expect(formatCaptionLineText('early in the day', 'sentence')).toBe('Early in the day')
    expect(formatCaptionChunk(['early', 'in', 'the', 'day'], 'sentence')).toBe('Early in the day')
  })

  it('keeps mid-sentence I and I\'m', () => {
    expect(formatCaptionLineText("hello I went and I'm ready", 'sentence')).toBe("Hello I went and I'm ready")
    expect(formatCaptionChunk(['hello', 'I', 'went', 'and', "I'm", 'ready'], 'sentence')).toBe(
      "Hello I went and I'm ready",
    )
    expect(formatCaptionWord("I'm", 'sentence', false)).toBe("I'm")
    expect(formatCaptionWord('I', 'sentence', false)).toBe('I')
  })

  it('keeps a mid-sentence proper noun such as Wayne State / Michigan', () => {
    expect(formatCaptionLineText('I studied at Wayne State in Michigan', 'sentence')).toBe(
      'I studied at Wayne State in Michigan',
    )
    expect(formatCaptionChunk(['I', 'studied', 'at', 'Wayne', 'State', 'in', 'Michigan'], 'sentence')).toBe(
      'I studied at Wayne State in Michigan',
    )
  })

  it('keeps mid-sentence acronyms such as AI and PhD', () => {
    expect(formatCaptionLineText('She earned a PhD in AI', 'sentence')).toBe('She earned a PhD in AI')
    expect(formatCaptionChunk(['She', 'earned', 'a', 'PhD', 'in', 'AI'], 'sentence')).toBe(
      'She earned a PhD in AI',
    )
    expect(formatCaptionWord('PhD', 'sentence', false)).toBe('PhD')
    expect(formatCaptionWord('AI', 'sentence', false)).toBe('AI')
  })

  it('capitalizes the first letter after a mid-cue sentence boundary and keeps the rest', () => {
    expect(formatCaptionLineText("ready. I'll study Egypt where I'd go.", 'sentence')).toBe(
      "Ready. I'll study Egypt where I'd go.",
    )
  })

  it('applies the same transform to SRT and ASS/preview', () => {
    const text = "hello I went to Wayne State for a PhD in AI and I'm from Michigan"
    const expected = "Hello I went to Wayne State for a PhD in AI and I'm from Michigan"
    expect(formatCaptionLineText(text, 'sentence')).toBe(expected)

    const edits = sentenceEdits([{ id: 'a', text, startMs: 200, endMs: 3000 }])
    const srt = buildNleCaptionsSrt([], edits, bounds)
    expect(srt).toContain(expected)
    expect(srt).not.toContain('hello i went')
    expect(srt).not.toContain("i'm")
    expect(srt).not.toContain('wayne state')
    expect(srt).not.toContain('phd')

    const words: AssWord[] = text.split(' ').map((w, i) => ({
      w,
      s: 0.2 + i * 0.1,
      e: 0.3 + i * 0.1,
    }))
    expect(assText(words, 'sentence')).toBe(expected)
  })

  it('still uppercases every letter in upper mode', () => {
    expect(formatCaptionLineText("I'm at Wayne State for a PhD", 'upper')).toBe("I'M AT WAYNE STATE FOR A PHD")
    expect(assText([{ w: "I'm", s: 0, e: 0.2 }, { w: 'at', s: 0.2, e: 0.4 }, { w: 'Wayne', s: 0.4, e: 0.6 }], 'upper')).toBe(
      "I'M AT WAYNE",
    )
  })
})

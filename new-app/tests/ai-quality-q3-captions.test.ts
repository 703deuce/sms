import { describe, expect, it } from 'vitest'
import { rebalanceCaptionBreaks, fitCaptionLine, captionFitConfigForEdits, captionChunkFit } from '@/lib/clips/caption-fit'

describe('Q3.1 caption orphan lines', () => {
  it('rebalanceCaptionBreaks pulls the break back off a one-word last line', () => {
    expect(rebalanceCaptionBreaks(5, [4])).toEqual([3])
  })

  it('9:16 long words: no orphan line in fitCaptionLine', () => {
    const cfg = captionFitConfigForEdits({ presetId: 'bold_pop', wordsPerLine: 4, size: 6.5 }, true, '9:16')
    const chunk = [
      'Supercalifragilistic',
      'hippopotomonstrosesquippedaliophobia',
      'is',
      'real',
      'word',
    ].map((w, i) => ({ w, i }))
    const f = captionChunkFit(cfg, chunk, new Set())
    expect(f.breaks.length).toBeLessThanOrEqual(1)
    if (f.breaks.length) {
      const lastLine = chunk.length - f.breaks[f.breaks.length - 1]!
      expect(lastLine).toBeGreaterThan(1)
    }
  })

  it('16:9 long words: fitCaptionLine max 2 lines without orphan', () => {
    const cfg = captionFitConfigForEdits({ presetId: 'bold_pop', wordsPerLine: 3, size: 6.5 }, true, '16:9')
    const words = ['Antidisestablishmentarianism', 'pneumonoultramicroscopicsilicovolcanoconiosis', 'end']
    const f = fitCaptionLine(words, {
      font: cfg.font,
      fontsize: cfg.fontsize,
      maxWidthPx: cfg.maxWidthPx,
      maxLines: 2,
    })
    if (f.breaks.length) {
      expect(words.length - f.breaks[0]!).toBeGreaterThan(1)
    }
  })
})

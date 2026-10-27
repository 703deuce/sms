import { describe, expect, it } from 'vitest'
import { parseScriptCompositionDocument } from '@/lib/server/clips/script-composition'

describe('parseScriptCompositionDocument', () => {
  it('preserves M4 fields from stored JSON', () => {
    const raw = {
      v: 1,
      keptWordIds: ['a:0'],
      deletedWordIds: [],
      settings: { aspect: '9:16', showDeletedWords: true },
      ignoredWordIds: ['a:1'],
      transcriptHiddenWordIds: ['a:2'],
      wordSourceAdjust: { 'a:0': { headTrimMs: 10 } },
      reframeKeyframes: [{ srcMs: 1000, crop: { cx: 50, cy: 50, w: 80, h: 80 } }],
    }
    const doc = parseScriptCompositionDocument(raw)
    expect(doc.settings?.aspect).toBe('9:16')
    expect(doc.ignoredWordIds).toEqual(['a:1'])
    expect(doc.transcriptHiddenWordIds).toEqual(['a:2'])
    expect(doc.wordSourceAdjust?.['a:0']?.headTrimMs).toBe(10)
    expect(doc.reframeKeyframes?.[0]?.srcMs).toBe(1000)
  })
})

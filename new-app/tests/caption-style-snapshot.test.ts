import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '../lib/clips/edits'
import {
  applyCaptionStyleSnapshot,
  buildCaptionStyleSnapshot,
  captionStyleSnapshotForSave,
  normalizeCaptionStyleSnapshot,
} from '../lib/clips/editor/caption-style-snapshot'
import { captionOptInsAreOff } from '../lib/clips/editor/caption-style-catalog'
import { buildNleCaptionsSrt } from '../lib/clips/export-nle-captions'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

function baseEdits(overrides: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return normalizeEdits({ ...defaultEdits(bounds), ...overrides }, bounds)
}

describe('caption style snapshot', () => {
  it('captures the complete current style, including fields the old save path omitted', () => {
    const cap: ClipEditsV2['captions'] = {
      enabled: true,
      presetId: 'clean_white',
      font: 'Anton',
      animation: 'none',
      size: 5,
      position: 'top',
      case: 'sentence',
      wordsPerLine: 4,
      colors: { a: '#FFFFFF', b: '#22C55E' },
      keywordHighlight: false,
      autoEmojis: false,
      marginVPct: 14,
      activeStyle: 'highlight',
      highlightColor: '#FDE047',
      presetConfig: { outlineW: 2 },
    }
    const snap = buildCaptionStyleSnapshot(cap)
    expect(snap.version).toBe(1)
    expect(snap.presetId).toBe('clean_white')
    expect(snap.font).toBe('Anton')
    expect(snap.marginVPct).toBe(14)
    expect(snap.activeStyle).toBe('highlight')
    expect(snap.highlightColor).toBe('#FDE047')
    expect(snap.presetConfig).toEqual({ outlineW: 2 })
    expect(snap.keywordHighlight).toBe(false)
    expect(snap.autoEmojis).toBe(false)
  })

  it('re-applies a saved style onto another clip without clobbering word fixes or caption lines', () => {
    const saved = captionStyleSnapshotForSave({
      enabled: true,
      presetId: 'clean_white',
      font: 'Montserrat Black',
      animation: 'none',
      size: 4.5,
      position: 'bottom',
      marginVPct: 10,
      activeStyle: 'color',
      autoEmojis: false,
      keywordHighlight: false,
    })
    const target = baseEdits({
      wordFixes: { '2': 'though' },
      wordFixMeta: { '2': { s: 1000, w: 'bro' } },
      captionLines: [{ id: 'cl1', text: 'hello though', startMs: 0, endMs: 1200 }],
      captions: { enabled: true, presetId: 'bold_pop', animation: 'pop', size: 6.5 },
    })
    const next: ClipEditsV2 = {
      ...target,
      captions: applyCaptionStyleSnapshot(target.captions, saved),
    }
    expect(next.captions.presetId).toBe('clean_white')
    expect(next.captions.font).toBe('Montserrat Black')
    expect(next.captions.animation).toBe('none')
    expect(next.captions.marginVPct).toBe(10)
    expect(next.wordFixes).toEqual({ '2': 'though' })
    expect(next.captionLines?.[0]?.text).toBe('hello though')
    const srt = buildNleCaptionsSrt(
      [{ i: 2, w: 'bro', s: 0, e: 1.2 }],
      next,
      bounds,
    )
    // Export/NLE SRT applies the style case transform (default sentence).
    expect(srt).toContain('Hello though')
  })

  it('still applies a legacy incomplete saved config', () => {
    const applied = applyCaptionStyleSnapshot(
      { enabled: true, presetId: 'bold_pop', size: 6.5, font: 'Poppins' },
      { presetId: 'boxed', animation: 'pop', size: 6 },
    )
    expect(applied.presetId).toBe('boxed')
    expect(applied.animation).toBe('pop')
    expect(applied.size).toBe(6)
    expect(applied.font).toBe('Poppins')
  })

  it('normalizes unknown keys out of the snapshot', () => {
    const snap = normalizeCaptionStyleSnapshot({
      presetId: 'clean_white',
      name: 'My style',
      wordFixes: { '1': 'nope' },
      emojiByWord: { '1': '🔥' },
    })
    expect(snap.presetId).toBe('clean_white')
    expect((snap as Record<string, unknown>).name).toBeUndefined()
    expect((snap as Record<string, unknown>).wordFixes).toBeUndefined()
    expect((snap as Record<string, unknown>).emojiByWord).toBeUndefined()
  })

  it('default edits have highlight and emoji off until opted in', () => {
    const edits = defaultEdits(bounds)
    expect(captionOptInsAreOff(edits.captions)).toBe(true)
  })
})

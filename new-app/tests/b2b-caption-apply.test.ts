import { describe, expect, it } from 'vitest'
import { applyDesignedCaptionPreset } from '@/lib/clips/editor/b2b-caption-apply'
import { resolvePreset } from '@/lib/clips/caption-presets'
import { defaultEdits } from '@/lib/clips/edits'

describe('B2B caption recipe selection', () => {
  const old = defaultEdits({ clipStartMs: 0, clipEndMs: 5000 }).captions
  it('applies all authored dimensions instead of reusing stale caption overrides', () => {
    const selected = resolvePreset('b2b_bold_word_pop_3')
    const updated = applyDesignedCaptionPreset({
      ...old,
      font: 'Caveat',
      size: 10,
      animation: 'none',
      case: 'sentence',
      wordsPerLine: 6,
      colors: { a: '#123456', b: '#654321' },
      presetConfig: { primary: '#123456', font: 'Caveat', sizePct: 10 },
    }, selected)
    expect(updated.presetId).toBe('b2b_bold_word_pop_3')
    expect(updated.font).toBe(selected.font)
    expect(updated.size).toBe(selected.sizePct)
    expect(updated.case).toBe(selected.case)
    expect(updated.wordsPerLine).toBe(selected.wordsPerLine)
    expect(updated.position).toBe(selected.position)
    expect(updated.marginVPct).toBe(selected.marginVPct)
    expect(updated.animation).toBe(selected.animation)
    expect(updated.colors).toBeUndefined()
    expect(updated.presetConfig).toBeUndefined()
  })
  it('preserves original legacy style switching semantics', () => {
    const updated = applyDesignedCaptionPreset({ ...old, font: 'Caveat', size: 8 }, resolvePreset('clean_white'))
    expect(updated.font).toBe('Caveat')
    expect(updated.size).toBe(8)
    expect(updated.presetId).toBe('clean_white')
  })
})

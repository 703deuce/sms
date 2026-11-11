import { describe, it, expect } from 'vitest'
import { CAPTION_PRESETS, resolvePreset, presetSlugToId } from '@/lib/clips/caption-presets'
import { buildCaptionsAss } from '@/lib/clips/render-plan/captions-ass'
import { findClipFont } from '@/lib/clips/font-manifest'

describe('120 opt-in Batch 2B caption designs', () => {
  it('preserves original IDs and default', () => {
    expect(CAPTION_PRESETS.slice(0, 14).map(p => p.slug)).toEqual(["bold-pop","clean-white","boxed","karaoke","minimal","neon","bounce","typewriter","slide-up","highlighter","word-pop","karaoke-highlight","heavy-outline","lower-third"])
    expect(resolvePreset().slug).toBe('bold-pop')
  })
  it('has exactly 12 authored families of ten, all resolvable by worker-compatible IDs', () => {
    const designs = CAPTION_PRESETS.filter(p => p.slug.startsWith('b2b-'))
    expect(designs).toHaveLength(120)
    expect(new Set(designs.map(p => p.slug)).size).toBe(120)
    for (const category of ["clean-editorial","bold-word-pop","condensed-punch","karaoke-fill","active-word-highlight","boxed-pill","outline-sticker","soft-shadow","serif-story","handwritten-hook","retro-comic","restrained-neon"]) {
      expect(designs.filter(p => p.slug.startsWith('b2b-' + category + '-'))).toHaveLength(10)
    }
    for (const p of designs) expect(resolvePreset(presetSlugToId(p.slug)).slug).toBe(p.slug)
  })
})

describe('Batch 2B real editor ASS preview contract', () => {
  const designs = CAPTION_PRESETS.filter(p => p.slug.startsWith('b2b-'))
  it('builds font-mapped ASS scripts for all 120 presets and 3 aspect ratios', () => {
    for (const p of designs) {
      expect(findClipFont(p.font), p.slug + ': pinned local font').toBeDefined()
      for (const [width, height] of [[180, 320], [240, 240], [320, 180]] as const) {
        const ass = buildCaptionsAss([
          { w: 'VISIBLE', s: 0, e: 0.5, i: 0 },
          { w: 'WORD', s: 0.5, e: 1.0, i: 1 },
        ], { enabled: true, presetId: presetSlugToId(p.slug) }, width, height)
        expect(ass).toContain('PlayResX: ' + width)
        expect(ass).toContain('PlayResY: ' + height)
        expect(ass).toContain('Style: Cap,')
        expect(ass).toContain('Dialogue:')
      }
    }
  })
  it('keeps mixed Unicode and RTL in the authoritative ASS preview script', () => {
    const samples = ['Café', 'Привет', 'مرحبا', 'नमस्ते', '日本語', '🙂', 'veryveryveryveryveryveryverylongword']
    const ass = buildCaptionsAss(
      samples.map((w, i) => ({ w, s: i * 0.2, e: (i + 1) * 0.2, i })),
      { enabled: true, presetId: 'b2b_clean_editorial_2', wordsPerLine: 2 },
      180, 320,
    )
    expect(ass).toContain('Dialogue:')
    expect(ass).toContain('مرحبا')
    expect(ass).toContain('日本語')
  })
})

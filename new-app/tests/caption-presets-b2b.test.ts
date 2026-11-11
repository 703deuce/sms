import { describe, it, expect } from 'vitest'
import { CAPTION_PRESETS, resolvePreset, presetSlugToId } from '@/lib/clips/caption-presets'

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

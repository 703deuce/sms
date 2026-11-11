import { describe, expect, it } from 'vitest'
import { applyPremiumCaptionStyle, clearPremiumCaptionStyle, PREMIUM_CAPTION_STYLES } from '@/lib/clips/premium-caption-styles'
import { CAPTION_PRESETS, resolveCaptionPreset } from '@/lib/clips/caption-presets'
import { buildCaptionsAss } from '@/lib/clips/render-plan/captions-ass'
import { CLIP_FONT_FILES } from '@/lib/clips/render-plan/preview-scripts'
import type { ClipEditsV2 } from '@/lib/clips/edits'

describe('premium OFL captions are opt-in and exportable', () => {
  it('keeps all fourteen classic presets unchanged', () => {
    expect(CAPTION_PRESETS).toHaveLength(14)
    expect(CAPTION_PRESETS.every(p => p.font === 'Poppins')).toBe(true)
  })

  it.each(PREMIUM_CAPTION_STYLES)('$name resolves to matching ASS family for JASSUB and worker', style => {
    const cap: ClipEditsV2['captions'] = { enabled: true, presetId: 'clean_white', font: 'Poppins',
      presetConfig: { existingUnknown: { retained: true } } }
    const original = JSON.stringify(cap)
    const applied = applyPremiumCaptionStyle(cap, style.id)
    expect(JSON.stringify(cap)).toBe(original)
    expect(applied.font).toBe(style.font)
    expect(applied.presetConfig?.existingUnknown).toEqual({ retained: true })
    expect(resolveCaptionPreset(applied).font).toBe(style.font)
    expect(CLIP_FONT_FILES[style.font.toLowerCase()]).toMatch(/\.ttf$/)
    const ass = buildCaptionsAss([{ w: 'Premium', s: 0, e: 0.5, i: 0 }, { w: 'captions', s: 0.5, e: 1, i: 1 }],
      applied, 720, 1280)
    expect(ass).toContain('Style: Cap,' + style.font + ',')
    expect(ass).not.toContain('Style: Cap,Poppins ExtraBold,')
    const cleared = clearPremiumCaptionStyle(applied)
    expect(cleared.font).toBeUndefined()
    expect(cleared.presetConfig?.existingUnknown).toEqual({ retained: true })
    expect(cleared.presetConfig?.typographyPresetId).toBeUndefined()
  })

  it('leaves a prior caption document byte-for-byte untouched until a user chooses a style', () => {
    const cap: ClipEditsV2['captions'] = { presetId: 'bold_pop', font: 'Anton', marginVPct: 14,
      presetConfig: { customOpacity: 63 } }
    expect(clearPremiumCaptionStyle(cap)).toBe(cap)
    expect(() => applyPremiumCaptionStyle(cap, 'unknown')).toThrow()
    expect(cap).toEqual({ presetId: 'bold_pop', font: 'Anton', marginVPct: 14,
      presetConfig: { customOpacity: 63 } })
  })
})

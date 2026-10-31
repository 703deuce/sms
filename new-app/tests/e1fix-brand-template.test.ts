import { describe, expect, it } from 'vitest'
import { applyBrandTemplateToEdits, describeTemplateChange, templateAppliedMessage } from '@/lib/clips/apply-brand'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { templateFromEdits } from '@/lib/clips/layers-template'

const bounds = { clipStartMs: 0, clipEndMs: 30000 }
const base = () => normalizeEdits(defaultEdits(bounds), bounds)

describe('E1fix bug 4: brand template selection persists and shows what changed', () => {
  it('v3 template (saved from Layers) writes brand.templateId so the Brand dropdown keeps it', () => {
    const src = base()
    const settings = { templateV3: templateFromEdits({ ...src, layout: { ...src.layout, mode: 'fit_top' } }, 'T22') }
    const next = applyBrandTemplateToEdits(src, {
      id: 'brand_t22',
      logoKey: 'ws/ws_1/brand/logo.png',
      introVideoKey: 'ws/ws_1/brand/intro.mp4',
      outroVideoKey: null,
      settings: settings as never,
    })
    const brand = next.brand as Record<string, unknown>
    expect(brand.templateId).toBe('brand_t22')
    expect(brand.logoKey).toBe('ws/ws_1/brand/logo.png')
    expect(brand.useIntro).toBe(true)
    expect(brand.useOutro).toBe(false)
    expect(next.layout.mode).toBe('fit_top')
    expect((next as { layersV?: number }).layersV).toBe(3)
  })

  it('legacy (non-v3) template still sets templateId', () => {
    const next = applyBrandTemplateToEdits(base(), { id: 'brand_t2', settings: { defaultLayoutMode: 'facecam_stack' } as never })
    expect((next.brand as Record<string, unknown>).templateId).toBe('brand_t2')
    expect(next.layout.mode).toBe('facecam_stack')
  })

  it('describes the change, or says the clip already matches', () => {
    const src = base()
    const same = applyBrandTemplateToEdits(src, { id: 't', settings: { templateV3: templateFromEdits(src, 'same') } as never })
    const changes = describeTemplateChange(src, same)
    expect(changes).not.toContain('layout → fit top')
    const msgSame = templateAppliedMessage('Same', describeTemplateChange(src, { ...same, brand: src.brand }))
    expect(msgSame).toMatch(/already matches/)

    const moved = applyBrandTemplateToEdits(src, {
      id: 't2',
      logoKey: 'logo.png',
      settings: { templateV3: templateFromEdits({ ...src, layout: { ...src.layout, mode: 'fit_top' } }, 'ft') } as never,
    })
    const c2 = describeTemplateChange(src, moved)
    expect(c2).toContain('layout → fit top')
    expect(c2).toContain('logo')
    expect(templateAppliedMessage('T22 test', c2)).toMatch(/^“T22 test” applied: layout → fit top/)
  })
})

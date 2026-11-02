import { describe, expect, it, vi } from 'vitest'
import { brandTemplateSettingsSchema } from '@/lib/clips/brand'
import { BRAND_STARTERS } from '@/lib/clips/brand-starters'
import { bgRemovalUiEnabled } from '@/lib/clips/editor/bg-removal'
import { captionStyleOptions, STARTER_LOOKS } from '@/lib/clips/editor/starter-templates'
import { t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { CAPTION_PRESETS_V2, T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'
import { buildTemplateCatalog, catalogCounts } from '@/lib/clips/templates/catalog'

describe('templates catalog', () => {
  it('buildTemplateCatalog has expected inventory', () => {
    const items = buildTemplateCatalog()
    const c = catalogCounts(items)
    expect(items.length).toBeGreaterThanOrEqual(40)
    expect(c.layout).toBe(14)
    expect(c.layout_template).toBe(21)
    expect(c.multicam).toBe(4)
    expect(c.caption).toBeGreaterThanOrEqual(25)
    expect(c.look).toBeGreaterThanOrEqual(12)
    expect(c.brand_starter).toBe(8)
    const keys = new Set(items.map((i) => `${i.kind}:${i.id}`))
    expect(keys.size).toBe(items.length)
  })

  it('STARTER_LOOKS reference valid presets', () => {
    const classic = new Set(captionStyleOptions(false).map((x) => x.id))
    for (const look of STARTER_LOOKS) {
      expect(CAPTION_PRESETS_V2[look.caption]?.deferred).not.toBe(true)
      expect(classic.has(look.captionFallback)).toBe(true)
      expect(T6_TEMPLATES_BY_ID[look.layoutTemplate]).toBeTruthy()
    }
  })

  it('BRAND_STARTERS settings parse', () => {
    const classic = new Set(captionStyleOptions(false).map((x) => x.id))
    const cp = new Set(Object.keys(CAPTION_PRESETS_V2))
    for (const s of BRAND_STARTERS) {
      brandTemplateSettingsSchema.partial().parse(s.settings)
      const pid = (s.settings.captionPreset as { presetId?: string })?.presetId
      expect(pid && (classic.has(pid) || cp.has(pid))).toBe(true)
    }
  })

  it('feature flags default on with opt-out', () => {
    vi.stubEnv('NEXT_PUBLIC_T6_TEMPLATES', '')
    expect(t6TemplatesEnabled()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_T6_TEMPLATES', '0')
    expect(t6TemplatesEnabled()).toBe(false)
    vi.stubEnv('NEXT_PUBLIC_CLIP_EDITOR_BG_REMOVAL', '')
    expect(bgRemovalUiEnabled()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_CLIP_EDITOR_BG_REMOVAL', '0')
    expect(bgRemovalUiEnabled()).toBe(false)
  })
})

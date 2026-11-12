import { describe, expect, it } from 'vitest'
import { BATCH9A_ANCHOR_RELEASES } from '@/lib/clips/real-video-templates/batch9a-anchors'
import { compileTemplateWithMusic } from '@/lib/clips/real-video-templates/music-sequence'
import { defaultEdits } from '@/lib/clips/edits'
import { templateFrameToMs } from '@/lib/clips/real-video-templates/sequence-contract'
import {
  BATCH9A_ANCHOR_TEXT_DESIGN,
  templateTextStylePreset,
} from '@/lib/clips/real-video-templates/template-text-presets'

describe('template text presets', () => {
  it('defines a style and animation preset for every Batch 9A anchor headline', () => {
    for (const id of Object.keys(BATCH9A_ANCHOR_TEXT_DESIGN)) {
      const design = BATCH9A_ANCHOR_TEXT_DESIGN[id]!
      expect(templateTextStylePreset(design.headline.stylePresetId), id).toBeTruthy()
      expect(templateTextStylePreset(design.closing.stylePresetId), id).toBeTruthy()
    }
  })

  it('compiles F01 with heavy stroke, uppercase hooks, and preset metadata', () => {
    const release = BATCH9A_ANCHOR_RELEASES[0]!
    const headline = release.family.texts[0]!
    expect(headline.stylePresetId).toBe('hook_punch')
    expect(headline.font).toBe('Anton')
    expect(headline.finish?.stroke?.width).toBeGreaterThanOrEqual(8)
    expect(headline.y).toBeGreaterThanOrEqual(22)
    expect(headline.y).toBeLessThanOrEqual(30)
    const compiled = compileTemplateWithMusic(release.family, release.design, {
      instanceId: 'tpl_text_test',
      media: Object.fromEntries(release.family.slots.map((slot, i) => [slot.id, {
        id: 'img_' + i, kind: 'image' as const,
        license: { id: 'owned', provenance: 'user-owned' as const, reference: 'test' },
      }])),
    }, {
      durationFrames: release.family.totalFrames,
      edits: defaultEdits({ clipStartMs: 0, clipEndMs: templateFrameToMs(release.family.totalFrames) }),
    })
    const layer = compiled.edits.textItems?.[0]
    expect(layer?.style.font).toBe('Anton')
    expect(layer?.style.case).toBe('upper')
    expect(layer?.style.stroke?.width).toBeGreaterThanOrEqual(8)
    expect(layer?.anim?.in?.type).toBe('pop')
  })
})

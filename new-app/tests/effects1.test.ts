import { describe, expect, it } from 'vitest'
import { FX2_KEYS, FX2_LABELS, FX_PRESETS, geomCss, invertLinear, monoMatrix, sepiaMatrix, zoomSize } from '@/lib/clips/editor/fx-library'
import { blockState, LAYER_ANIM_TYPES, normLayerAnim, TEXT_ANIM_IN_TYPES } from '@/lib/clips/render-plan/text-anim'
import { previewLayoutMode } from '@/components/clips/editor/preview-stage'
import type { ClipEditsV2 } from '@/lib/clips/edits'

describe('EFFECTS1 registry', () => {
  it('appends the new keys in worker order with labels', () => {
    expect(FX2_KEYS.slice(-5)).toEqual(['mono', 'sepia', 'invert', 'mirror', 'zoom'])
    for (const k of FX2_KEYS) expect(FX2_LABELS[k]).toBeTruthy()
    for (const p of FX_PRESETS) for (const k of Object.keys(p.fx)) expect([...FX2_KEYS, 'sharpen', 'vignette', 'grain']).toContain(k)
  })
  it('colour maths match fx_library.py', () => {
    expect(monoMatrix(100).slice(0, 3)).toEqual([0.2126, 0.7152, 0.0722])
    expect(sepiaMatrix(0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
    expect(invertLinear(100)).toEqual([-1, 1])
    expect(zoomSize(30, 320, 568)).toEqual([368, 654])
  })
  it('geometry transform = shake, mirror, zoom', () => {
    expect(geomCss({ mirror: 100 }, 320, 568, 0)).toBe('scaleX(-1)')
    expect(geomCss({ zoom: 30 }, 320, 568, 0)).toBe('scale(1.15, 1.1514)')
    expect(geomCss(null, 320, 568, 0)).toBe('')
  })
})

describe('EFFECTS1 text animations', () => {
  it('adds bounce_in / zoom_out for text only', () => {
    expect(TEXT_ANIM_IN_TYPES).toContain('bounce_in')
    expect(LAYER_ANIM_TYPES).not.toContain('zoom_out')
    expect(blockState('zoom_out', 0).sc).toBe(1.6)
    expect(normLayerAnim({ in: { type: 'bounce_in', durMs: 400 } })?.in?.type).toBe('fade')
  })
})

describe('EFFECTS1 layout preview mapping', () => {
  const mk = (aspectRatio: string, mode: string) => ({ aspectRatio, layout: { mode } }) as unknown as ClipEditsV2
  it('16:9 keeps Fill, maps the rest to fit; 9:16 untouched', () => {
    expect(previewLayoutMode(mk('16:9', 'center_crop'))).toBe('center_crop')
    expect(previewLayoutMode(mk('16:9', 'speaker_follow'))).toBe('fit')
    expect(previewLayoutMode(mk('9:16', 'facecam_stack'))).toBe('facecam_stack')
  })
})

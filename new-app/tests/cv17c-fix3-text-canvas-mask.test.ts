// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applyTextFxLayerFx, textFxClipPath, textFxMaskEl } from '@/components/clips/editor/g4/layer-fx-preview'

describe('text fx mask target', () => {
  it('textFxMaskEl uses libass layer wrapper when present', () => {
    const host = document.createElement('div')
    const layer = document.createElement('div')
    layer.setAttribute('data-testid', 'libass-layer')
    const cv = document.createElement('canvas')
    cv.setAttribute('data-testid', 'libass-canvas')
    layer.appendChild(cv)
    host.appendChild(layer)
    expect(textFxMaskEl(host)).toBe(layer)
    const alone = document.createElement('div')
    expect(textFxMaskEl(alone)).toBe(alone)
  })

  it('textFxClipPath builds ellipse and inverted hole', () => {
    const m = { shape: 'ellipse' as const, x: 50, y: 50, w: 15, h: 10, rot: 0, feather: 0 }
    expect(textFxClipPath(m, 0)).toContain('ellipse(7.5% 5% at 50% 50%)')
    expect(textFxClipPath({ ...m, invert: true }, 0)).toContain('evenodd')
  })

  it('applyTextFxLayerFx clears stale host mask when canvas is used', () => {
    const host = document.createElement('div')
    const cv = document.createElement('canvas')
    cv.setAttribute('data-testid', 'libass-canvas')
    host.appendChild(cv)
    host.dataset.g4bMask = '1'
    applyTextFxLayerFx(host, { target: 'text:t1', blend: 'screen' }, 0, 1080, 1920)
    expect(host.dataset.g4bMask).toBeUndefined()
    expect(host.style.mixBlendMode).toBe('screen')
  })
})

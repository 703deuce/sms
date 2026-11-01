// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applyTextFxLayerFx, textFxMaskEl } from '@/components/clips/editor/g4/layer-fx-preview'

describe('text fx mask target', () => {
  it('textFxMaskEl uses libass canvas when present', () => {
    const host = document.createElement('div')
    const cv = document.createElement('canvas')
    cv.setAttribute('data-testid', 'libass-canvas')
    host.appendChild(cv)
    expect(textFxMaskEl(host)).toBe(cv)
    const alone = document.createElement('div')
    expect(textFxMaskEl(alone)).toBe(alone)
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

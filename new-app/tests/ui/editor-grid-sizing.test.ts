// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applyEditorGridSizing } from '@/lib/clips/editor/use-editor-grid-sizing'

describe('editor grid container sizing', () => {
  it('fits 1366px and 125% zoom (~1093px) without a wide properties column', () => {
    const el = document.createElement('div')
    applyEditorGridSizing(el, 1366)
    expect(el.style.getPropertyValue('--editor-tools-w')).toBe('273px')
    expect(el.style.getPropertyValue('--editor-props-w')).toBe('232px')
    expect(el.style.getPropertyValue('--editor-props-visible')).toBe('flex')

    applyEditorGridSizing(el, 1093)
    expect(Number.parseInt(el.style.getPropertyValue('--editor-tools-w'), 10)).toBeLessThanOrEqual(200)
    expect(el.style.getPropertyValue('--editor-props-visible')).toBe('none')
  })
})

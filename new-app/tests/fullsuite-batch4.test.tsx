// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits } from '@/lib/clips/edits'
import { BG_DEFAULT } from '@/lib/clips/editor/bg-removal'
import { BgRemovalSection } from '@/components/clips/editor/g4/bg-removal-section'
import { PropertiesPanel } from '@/components/clips/editor/properties-panel'
import { editorTemplateSpec } from '@/lib/clips/templates/editor-spec'

afterEach(() => cleanup())

const base = () => defaultEdits({ clipStartMs: 0, clipEndMs: 31_000 })

describe('Full editor suite Batch 4 regressions', () => {
  it('F7 off removes previous background-removal settings rather than leaving hidden stale values', () => {
    const edits = { ...base(), bgRemoval: {
      ...BG_DEFAULT, enabled: true,
      quality: 'detail' as const,
      background: { type: 'color' as const, color: '00b140' },
      refine: { feather: 32, choke: -50 },
    } }
    const onCommit = vi.fn()
    const ui = render(<BgRemovalSection edits={edits} onCommit={onCommit} />)
    fireEvent.click(ui.getByTestId('bg-removal-off'))
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ bgRemoval: undefined }))
  })

  it('F8 I2 portrait layout does not generate a thin landscape template strip', () => {
    const edits = { ...base(), aspectRatio: '16:9' as const,
      layout: { ...base().layout, mode: 'fit_blur' as const,
        template: { id: 'I2', auto: false, lane: 'irl' as const } } }
    expect(editorTemplateSpec(edits, null)).toBeNull()
  })

  it('F9 Properties Color tab is a selectable, visible fifth tab', () => {
    const ui = render(<PropertiesPanel edits={base()} target="video" label="Video"
      outputMs={0} onCommit={vi.fn()} onSeekOutput={vi.fn()}
      cropMode={false} onCropModeChange={vi.fn()}
      colorSlot={<div data-testid="color-editor">Color controls</div>} />)
    const colorTab = ui.getByTestId('properties-tab-color') as HTMLButtonElement
    expect(colorTab.disabled).toBe(false)
    fireEvent.click(colorTab)
    expect(colorTab.getAttribute('aria-selected')).toBe('true')
    expect(ui.getByTestId('color-editor')).toBeTruthy()
  })
})

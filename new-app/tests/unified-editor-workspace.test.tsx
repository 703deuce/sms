// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { UnifiedEditorWorkspace } from '@/components/clips/editor/unified-editor-workspace'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function mount(timelineView: 'script' | 'timeline' = 'timeline') {
  const onTimelineViewChange = vi.fn()
  const onInspectorWidthChange = vi.fn()
  const ui = render(
    <UnifiedEditorWorkspace
      main={<div data-testid="shared-editor-main">Transcript and player</div>}
      inspector={<div data-testid="shared-editor-tools">Properties and other tools</div>}
      timeline={<div data-testid="shared-editor-timeline">Track lanes</div>}
      timelineView={timelineView}
      onTimelineViewChange={onTimelineViewChange}
      inspectorWidthPx={360}
      onInspectorWidthChange={onInspectorWidthChange}
    />,
  )
  // On narrow test viewports the Inspector deliberately starts closed.
  if (!ui.queryByTestId('shared-editor-tools')) fireEvent.click(ui.getByTestId('unified-inspector-toggle'))
  return { ...ui, onTimelineViewChange, onInspectorWidthChange }
}

describe('unified editor workspace', () => {
  it('places the single Inspector beside both the upper workspace and timeline', () => {
    const ui = mount()
    expect(ui.getAllByTestId('shared-editor-main')).toHaveLength(1)
    expect(ui.getAllByTestId('shared-editor-tools')).toHaveLength(1)
    expect(ui.getAllByTestId('shared-editor-timeline')).toHaveLength(1)
    expect(ui.getByTestId('unified-editor-columns').style.gridTemplateColumns).toContain('360px')
    expect(ui.getByTestId('unified-main-workspace').style.gridTemplateRows).toContain('56fr')
  })

  it('supports compact, full timeline and focus without remounting a second Inspector', () => {
    const ui = mount('script')
    expect(ui.getByTestId('unified-main-workspace').getAttribute('data-timeline-mode')).toBe('compact')
    fireEvent.click(ui.getByTestId('unified-mode-expanded'))
    expect(ui.onTimelineViewChange).toHaveBeenCalledWith('timeline')
    fireEvent.click(ui.getByTestId('unified-mode-focus'))
    expect(ui.onTimelineViewChange).toHaveBeenCalledWith('timeline')
    expect(ui.getByTestId('unified-main-workspace').getAttribute('data-timeline-mode')).toBe('focus')
    expect(ui.getByTestId('unified-upper-workspace').className).toContain('hidden')
    expect(ui.getAllByTestId('shared-editor-main')).toHaveLength(1)
    expect(ui.getAllByTestId('shared-editor-timeline')).toHaveLength(1)
    expect(ui.getAllByTestId('shared-editor-tools')).toHaveLength(1)
    fireEvent.click(ui.getByTestId('unified-mode-compact'))
    expect(ui.onTimelineViewChange).toHaveBeenCalledWith('script')
  })

  it('collapses the right panel, preserving the player and timeline', () => {
    const ui = mount()
    fireEvent.click(ui.getByTestId('unified-inspector-toggle'))
    expect(ui.queryByTestId('shared-editor-tools')).toBeNull()
    expect(ui.getAllByTestId('shared-editor-main')).toHaveLength(1)
    expect(ui.getAllByTestId('shared-editor-timeline')).toHaveLength(1)
    fireEvent.click(ui.getByTestId('unified-inspector-toggle'))
    expect(ui.getAllByTestId('shared-editor-tools')).toHaveLength(1)
  })

  it('supports keyboard resizing of timeline and Inspector', () => {
    const ui = mount()
    fireEvent.keyDown(ui.getByTestId('unified-timeline-resize'), { key: 'ArrowUp' })
    expect(ui.getByTestId('unified-main-workspace').style.gridTemplateRows).toContain('59fr')
    fireEvent.keyDown(ui.getByTestId('unified-inspector-resize'), { key: 'ArrowLeft' })
    expect(ui.onInspectorWidthChange).toHaveBeenCalledWith(372)
  })
})

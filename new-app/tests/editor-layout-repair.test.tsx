// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { EditorLayout, EDITOR_GRID } from '@/components/clips/editor/editor-layout'
import { ScriptViewToolTabs } from '@/components/clips/editor/script-view-tool-rail'
import { clipEditorLeftPanelIds } from '@/lib/clips/editor/editor-rail-navigation'

afterEach(() => cleanup())

describe('controlled editor layout repair', () => {
  it('keeps inspector available as a left-panel destination', () => {
    expect(clipEditorLeftPanelIds(false)).toContain('inspector')
    expect(clipEditorLeftPanelIds(true)).toContain('inspector')
  })

  it('uses a two-column Timeline dock with a bounded full-width timeline row', () => {
    expect(EDITOR_GRID.rootDock).toContain('lg:grid-cols-[clamp(280px,28vw,440px)_minmax(0,1fr)]')
    expect(EDITOR_GRID.rootDock).toContain('lg:grid-rows-[auto_minmax(0,1fr)_minmax(220px,40%)]')
    const ui = render(
      <EditorLayout
        band="desktop"
        rail={<div>Tools</div>}
        panel={<div>Tool panel</div>}
        panelOpen
        onClosePanel={vi.fn()}
        preview={<div>Video</div>}
        properties={<div data-testid="old-right-properties">Old properties</div>}
        timeline={<div>Tracks</div>}
        dockTools
      />,
    )
    expect(ui.queryByTestId('old-right-properties')).toBeNull()
    expect(ui.getByTestId('editor-grid').querySelector('[data-region="timeline"]')).toBeTruthy()
    expect(ui.getByTestId('editor-grid').querySelector('[data-region="preview"]')).toBeTruthy()
  })

  it('does not mount a duplicate hidden tool panel in Script view', () => {
    const ui = render(
      <EditorLayout
        band="desktop"
        rail={<div>Mobile tools</div>}
        panel={<div data-testid="legacy-tool-panel">Legacy tool panel</div>}
        panelOpen
        onClosePanel={vi.fn()}
        preview={<div data-testid="script-preview">Script preview and tools</div>}
        properties={null}
        timeline={<div>Compact timeline</div>}
        hidePanelColumn
        hidePropertiesColumn
      />,
    )
    expect(ui.queryByTestId('legacy-tool-panel')).toBeNull()
    expect(ui.getByTestId('editor-grid').querySelectorAll('[data-region="panel"]')).toHaveLength(0)
    expect(ui.getByTestId('script-preview')).toBeTruthy()
    expect(ui.getByTestId('editor-grid').querySelectorAll('[data-region="preview"]')).toHaveLength(1)
  })

  it('shows the real Script tab and routes tool tabs without a separate drawer', () => {
    const onSelect = vi.fn()
    const onShowScript = vi.fn()
    const ui = render(<ScriptViewToolTabs active={null} onSelect={onSelect} onShowScript={onShowScript} />)
    fireEvent.click(ui.getByTestId('script-tool-inspector'))
    expect(onSelect).toHaveBeenCalledWith('inspector')
    fireEvent.click(ui.getByTestId('script-tool-layout'))
    expect(onSelect).toHaveBeenCalledWith('layout')
    fireEvent.click(ui.getByTestId('script-tool-captions'))
    expect(onSelect).toHaveBeenCalledWith('captions')
    fireEvent.click(ui.getByTestId('script-tool-transcript'))
    expect(onShowScript).toHaveBeenCalledTimes(1)
    expect(ui.queryByTestId('script-view-tool-drawer')).toBeNull()
  })
})

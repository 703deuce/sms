// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StandaloneEditorChrome, StandaloneEditorToolRail, finishStandaloneLayoutHandoff } from '@/components/clips/editor/standalone-editor-chrome'
import { LayoutGrid } from 'lucide-react'

afterEach(() => cleanup())

describe('standalone editor chrome', () => {
  it('renders only real File/Edit/View controls plus the shared mode switcher', () => {
    const noop = vi.fn()
    render(
      <StandaloneEditorChrome
        projectTitle="Project"
        title="Clip"
        current="story"
        saveState="saved"
        canUndo
        canRedo={false}
        onBack={noop}
        onUndo={noop}
        onRedo={noop}
        onExport={noop}
        onRetrySave={noop}
        onModeSelect={noop}
        onLayoutSelect={noop}
      />,
    )
    expect(screen.getByTestId('standalone-menu-file')).toBeTruthy()
    expect(screen.getByTestId('standalone-menu-edit')).toBeTruthy()
    expect(screen.getByTestId('standalone-menu-view')).toBeTruthy()
    expect(screen.getByTestId('editor-mode-story').getAttribute('aria-current')).toBe('page')
  })

  it('flushes, writes the existing layout preference, then navigates', async () => {
    const order: string[] = []
    await finishStandaloneLayoutHandoff({
      view: 'timeline',
      projectId: 'p1',
      clipId: 'c1',
      flushSave: async () => { order.push('flush') },
      persistLayout: (view) => { order.push('persist:' + view) },
      navigate: (url) => { order.push('navigate:' + url) },
    })
    expect(order).toEqual([
      'flush',
      'persist:timeline',
      'navigate:/app/video-editor/p1/edit/c1',
    ])
  })

  it('keeps the standalone tool rail at one 56px column', () => {
    render(
      <StandaloneEditorToolRail
        label="Template tools"
        items={[{ id: 'layouts', label: 'Layouts', icon: LayoutGrid, active: true, onSelect: vi.fn() }]}
      />,
    )
    const rail = screen.getByTestId('standalone-editor-tool-rail')
    expect(rail.className).toContain('w-14')
    expect(screen.getByRole('button', { name: /Layouts/i }).getAttribute('aria-current')).toBe('page')
  })
})

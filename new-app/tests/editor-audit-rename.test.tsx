// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { EditorProjectMenu } from '@/components/clips/editor/editor-project-menu'

afterEach(() => cleanup())
const actions = {
  newProject: { kind: 'link' as const, label: 'New project', href: '/app/clips/new' },
  openProjects: { kind: 'link' as const, label: 'Open projects', href: '/app/clips' },
  export: { kind: 'button' as const, label: 'Export', onClick: vi.fn() },
  backToProjects: { kind: 'link' as const, label: 'Back to projects', href: '/app/clips' },
}
describe('Editor audit: project title rename', () => {
  it('Escape discards draft title instead of committing changes', async () => {
    const onTitleChange = vi.fn()
    const ui = render(<EditorProjectMenu title="Original title" onTitleChange={onTitleChange} actions={actions} />)
    fireEvent.click(ui.getByTestId('editor-project-menu-trigger'))
    fireEvent.click(await ui.findByText('Rename'))
    const input = await ui.findByTestId('editor-clip-title-input')
    fireEvent.change(input, { target: { value: 'Accidental title' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(ui.queryByTestId('editor-clip-title-input')).toBeNull())
    expect(onTitleChange).not.toHaveBeenCalled()
    expect(ui.getByTestId('editor-project-menu-trigger').textContent).toContain('Original title')
  })
})

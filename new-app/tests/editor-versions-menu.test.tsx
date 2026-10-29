// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorVersionsMenu } from '@/components/clips/editor/editor-versions-menu'

describe('EditorVersionsMenu', () => {
  it('opens menu with items without throwing (Base UI group context)', async () => {
    const onSave = vi.fn()
    render(
      <EditorVersionsMenu
        enabled
        versions={[
          {
            id: 'v1',
            name: 'Before headline',
            kind: 'named',
            createdAt: new Date().toISOString(),
          },
        ]}
        onSaveVersion={onSave}
        onRestoreVersion={vi.fn()}
        onDeleteVersion={vi.fn()}
        onRestoreOriginal={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('versions-menu'))
    await waitFor(() => {
      expect(screen.getByTestId('versions-save-item')).toBeTruthy()
      expect(screen.getByTestId('versions-row-v1')).toBeTruthy()
      expect(screen.getByTestId('versions-restore-original')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('versions-save-item'))
    expect(onSave).toHaveBeenCalled()
  })
})

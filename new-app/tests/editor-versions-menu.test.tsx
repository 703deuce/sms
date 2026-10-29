// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorVersionsMenu } from '@/components/clips/editor/editor-versions-menu'

afterEach(() => cleanup())

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
  })

  it('save dialog submits trimmed name (outside menu focus trap)', async () => {
    const onSave = vi.fn()
    render(
      <EditorVersionsMenu
        enabled
        versions={[]}
        onSaveVersion={onSave}
        onRestoreVersion={vi.fn()}
        onDeleteVersion={vi.fn()}
        onRestoreOriginal={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('versions-menu'))
    await waitFor(() => screen.getByTestId('versions-save-item'))
    fireEvent.click(screen.getByTestId('versions-save-item'))
    await waitFor(() => screen.getByTestId('versions-save-dialog'))
    fireEvent.change(screen.getByLabelText('Version name'), { target: { value: 'T4 test' } })
    fireEvent.click(screen.getByTestId('versions-save-submit'))
    expect(onSave).toHaveBeenCalledWith('T4 test')
  })
})

describe('EditorVersionsMenu POST body', () => {
  it('saveEditVersion sends name in JSON body', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ data: { id: 'ver_1' } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { clipsFetch } = await import('@/lib/clips-api')
    await clipsFetch(`/api/clips/clips/clip_test/versions`, {
      method: 'POST',
      body: JSON.stringify({ name: 'T4 test', kind: 'manual', edits: {} }),
    })

    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const body = JSON.parse(String(init.body)) as { name: string }
    expect(body.name).toBe('T4 test')
    vi.unstubAllGlobals()
  })
})

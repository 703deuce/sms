// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { defaultEdits } from '@/lib/clips/edits'

const mocks = vi.hoisted(() => ({
  loadPreferences: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(async () => ({ channels: [] })),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
}))
vi.mock('@/lib/clips/export-preferences-sync', () => ({
  loadMergedExportDialogPreferences: mocks.loadPreferences,
  persistExportDialogPreferences: vi.fn(),
}))
vi.mock('@/lib/billing/entitlements', () => ({ can: vi.fn(() => true) }))
vi.mock('sonner', () => ({ toast: { loading: vi.fn(), dismiss: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

describe('PR7 XE04/XE05 export dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadPreferences.mockResolvedValue({ alsoSrt: false, alsoVtt: false, exportSfx: 'off' })
  })

  function openDialog() {
    return render(
      <ExportDialog
        clipId="fixture-clip" title="Fixture" edits={defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })}
        open onClose={() => {}} />
    )
  }

  it('keeps the action bar inside the bounded modal instead of below all advanced options', () => {
    const { container } = openDialog()
    const dialog = screen.getByRole('dialog')
    const actions = screen.getByTestId('export-dialog-actions')
    expect(dialog.contains(actions)).toBe(true)
    expect(actions.className).toContain('sticky')
    expect(actions.className).toContain('bottom-0')
    expect(container.textContent).toContain('Close')
  })

  it('does not overwrite an explicit aspect selection when preferences finish loading', async () => {
    let resolve!: (value: unknown) => void
    mocks.loadPreferences.mockReturnValue(new Promise((r) => { resolve = r }))
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: '1:1' }))
    expect(screen.getByText(/Output 1080×1080/)).toBeTruthy()
    resolve({ alsoSrt: false, alsoVtt: false, exportSfx: 'off', defaultAspect: '9:16', defaultResolution: '720p' })
    await waitFor(() => expect(screen.getByText(/Output 1080×1080/)).toBeTruthy())
  })
})

// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(() => Promise.resolve({ channels: [] })),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
}))

vi.mock('@/lib/clips/export-preferences-sync', () => ({
  loadMergedExportDialogPreferences: vi.fn(() =>
    Promise.resolve({
      alsoSrt: false,
      exportSfx: 'off',
      defaultAspect: '9:16',
      defaultResolution: '720p',
    }),
  ),
  persistExportDialogPreferences: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/billing/entitlements', () => ({ can: vi.fn(() => true) }))

const bounds = { clipStartMs: 0, clipEndMs: 60000 }
const edits = normalizeEdits(defaultEdits(bounds), bounds)

describe('ExportDialog Escape', () => {
  it('closes on Escape even when another window listener consumes the key first in bubble phase', () => {
    const onClose = vi.fn()
    const shellLike = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', shellLike)

    render(
      <ExportDialog
        clipId="clip_test"
        title="Test"
        edits={edits}
        open
        onClose={onClose}
        layoutMode={edits.layout.mode}
        facecamLayout={null}
        reframeV2Enabled={false}
      />,
    )

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    window.removeEventListener('keydown', shellLike)
  })
})

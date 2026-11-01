// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'

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
      defaultAspect: '16:9',
      defaultResolution: '1080p',
    }),
  ),
  persistExportDialogPreferences: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}))

vi.mock('@/lib/billing/entitlements', () => ({ can: vi.fn(() => true) }))

const bounds = { clipStartMs: 0, clipEndMs: 60000 }

describe('ExportDialog 16:9 resolution', () => {
  beforeEach(() => {
    vi.mocked(clipsFetch).mockImplementation(((path: string) =>
      path.includes('active-render') ? Promise.resolve({}) : Promise.resolve({ channels: [] })) as typeof clipsFetch)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps 720p after user selects it on full-video 16:9 (no prefs re-apply reset)', async () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), aspectRatio: '16:9' }, bounds)
    const { getByRole, rerender, container } = render(
      <ExportDialog
        clipId="clip_169"
        title="16:9 test"
        edits={edits}
        open
        fullVideo
        onClose={() => {}}
        layoutMode={edits.layout.mode}
        facecamLayout={null}
        reframeV2Enabled={false}
      />,
    )
    await waitFor(() => {
      expect(container.textContent).toMatch(/1080p/)
    })
    fireEvent.click(getByRole('button', { name: '720p' }))
    await waitFor(() => {
      expect(container.textContent).toMatch(/Output 1280×720 @ 720p/)
    })
    rerender(
      <ExportDialog
        clipId="clip_169"
        title="16:9 test"
        edits={{ ...edits, silenceTrim: { ...edits.silenceTrim, enabled: true } }}
        open
        fullVideo
        onClose={() => {}}
        layoutMode={edits.layout.mode}
        facecamLayout={null}
        reframeV2Enabled={false}
      />,
    )
    expect(container.textContent).toMatch(/Output 1280×720 @ 720p/)
    expect(container.textContent).not.toMatch(/Output 1920×1080 @ 1080p/)
  })
})

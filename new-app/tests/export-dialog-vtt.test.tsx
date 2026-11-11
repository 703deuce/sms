// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { exportClipWithOptions } from '@/lib/clips-api'
import { persistExportDialogPreferences } from '@/lib/clips/export-preferences-sync'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(() => Promise.resolve({ channels: [] })),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
  downloadClipNleZip: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/clips/export-preferences-sync', () => ({
  loadMergedExportDialogPreferences: vi.fn(() =>
    Promise.resolve({
      alsoSrt: false,
      alsoVtt: false,
      exportSfx: 'off',
      defaultAspect: '9:16',
      defaultResolution: '720p',
    }),
  ),
  persistExportDialogPreferences: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/billing/entitlements', () => ({
  can: vi.fn(() => true),
}))

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
const edits = normalizeEdits(defaultEdits(bounds), bounds)

describe('ExportDialog VTT download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(exportClipWithOptions).mockResolvedValue({
      renderId: 'render_vtt',
      downloadUrl: null,
      filename: 'clip.mp4',
      watermark: false,
      status: 'RUNNING',
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('offers a persisted VTT option and opens the existing VTT route after export starts', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { findByTestId } = render(
      <ExportDialog
        clipId="clip_vtt"
        title="VTT clip"
        edits={edits}
        open
        onClose={() => {}}
        layoutMode={edits.layout.mode}
        facecamLayout={null}
        reframeV2Enabled={false}
      />,
    )

    const exportButton = await findByTestId('export-mp4-button')
    await waitFor(() => {
      expect(exportButton.textContent).not.toMatch(/Checking/i)
    })

    fireEvent.click(await findByTestId('export-vtt-toggle'))
    expect(persistExportDialogPreferences).toHaveBeenCalledWith({ alsoVtt: true })

    fireEvent.click(exportButton)
    await waitFor(() => {
      expect(exportClipWithOptions).toHaveBeenCalledTimes(1)
      expect(open).toHaveBeenCalledWith('/api/clips/clips/clip_vtt/vtt', '_blank')
    })
    expect(open).not.toHaveBeenCalledWith('/api/clips/clips/clip_vtt/srt', '_blank')
  })
})

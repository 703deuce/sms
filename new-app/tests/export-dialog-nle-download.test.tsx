// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, waitFor, cleanup } from '@testing-library/react'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { downloadClipNleZip, clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

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
  },
}))

vi.mock('@/lib/billing/entitlements', () => ({
  can: vi.fn(() => true),
}))

const bounds = { clipStartMs: 0, clipEndMs: 32_000 }
const edits = normalizeEdits(defaultEdits(bounds), bounds)

describe('ExportDialog NLE zip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('uses authed fetch download path instead of anchor href', async () => {
    const { findByTestId } = render(
      <ExportDialog
        clipId="clip_5f19e510a23241c29190475d4723aa21"
        title="Slide MC"
        edits={edits}
        open
        onClose={() => {}}
        layoutMode={edits.layout.mode}
        facecamLayout={null}
        reframeV2Enabled={false}
        platform="twitch"
        defaultChannelUrl=""
      />,
    )
    const btn = await findByTestId('export-xml-download')
    expect(btn.getAttribute('href')).toBeNull()
    fireEvent.click(btn)
    await waitFor(() => {
      expect(downloadClipNleZip).toHaveBeenCalledWith('clip_5f19e510a23241c29190475d4723aa21', 'Slide MC')
    })
    expect(toast.success).toHaveBeenCalled()
    expect(clipsFetch).not.toHaveBeenCalledWith(expect.stringContaining('export-xml'), expect.anything())
  })

  it('shows error toast when NLE download fails', async () => {
    vi.mocked(downloadClipNleZip).mockRejectedValueOnce(new Error('Authentication required'))
    const { findByTestId } = render(
      <ExportDialog
        clipId="clip_x"
        title="Test"
        edits={edits}
        open
        onClose={() => {}}
        layoutMode={edits.layout.mode}
        facecamLayout={null}
        reframeV2Enabled={false}
        platform="twitch"
        defaultChannelUrl=""
      />,
    )
    const btn = await findByTestId('export-xml-download')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Authentication required')
    })
  })

  it('does not download an NLE zip until the caption sync warning is acknowledged', async () => {
    const drifted = normalizeEdits(
      {
        ...defaultEdits(bounds),
        captionLines: [
          { id: 'a', text: 'Hello', startMs: 20_000, endMs: 20_600 },
          { id: 'b', text: 'there', startMs: 20_700, endMs: 21_300 },
          { id: 'c', text: 'friends', startMs: 21_400, endMs: 22_000 },
        ],
      },
      bounds,
    )
    const words = [
      { i: 0, w: 'Hello', s: 0.2, e: 0.6 },
      { i: 1, w: 'there', s: 0.6, e: 1.0 },
      { i: 2, w: 'friends', s: 1.1, e: 1.6 },
    ]
    const { findByTestId } = render(
      <ExportDialog
        clipId="clip_sync"
        title="Drifted"
        edits={drifted}
        words={words}
        open
        onClose={() => {}}
        layoutMode={drifted.layout.mode}
        facecamLayout={null}
        reframeV2Enabled={false}
      />,
    )
    const warning = await findByTestId('caption-sync-warning-nle')
    expect(warning.textContent).toMatch(/out of sync/i)
    const btn = await findByTestId('export-xml-download')
    expect(btn).toHaveProperty('disabled', true)
    fireEvent.click(btn)
    expect(downloadClipNleZip).not.toHaveBeenCalled()

    fireEvent.click(await findByTestId('caption-sync-export-ack-nle'))
    await waitFor(() => {
      expect(btn).toHaveProperty('disabled', false)
    })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(downloadClipNleZip).toHaveBeenCalledWith('clip_sync', 'Drifted')
    })
  })
})

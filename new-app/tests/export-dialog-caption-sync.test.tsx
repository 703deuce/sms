// @vitest-environment happy-dom
// @ts-expect-error root tsc does not resolve the new-app vitest install
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
// @ts-expect-error root tsc does not resolve @testing-library/react
import { fireEvent, render, waitFor, cleanup } from '@testing-library/react'
import { ExportDialog } from '../components/clips/editor/export-dialog'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '../lib/clips/edits'
import { exportClipWithOptions } from '../lib/clips-api'
import { FetchJsonError } from '../lib/client/fetch-json'
import { CAPTION_SYNC_REQUIRED } from '../lib/clips/editor/caption-sync-warning'

vi.mock('../lib/clips-api', () => ({
  clipsFetch: vi.fn(() => Promise.resolve({ channels: [] })),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
  downloadClipNleZip: vi.fn(() => Promise.resolve()),
}))

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
    info: vi.fn(),
  },
}))

vi.mock('@/lib/billing/entitlements', () => ({
  can: vi.fn(() => true),
}))

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
const words = [
  { i: 0, w: 'Hello', s: 0.2, e: 0.6 },
  { i: 1, w: 'there', s: 0.6, e: 1.0 },
  { i: 2, w: 'friends', s: 1.1, e: 1.6 },
  { i: 3, w: 'today', s: 2.0, e: 2.4 },
]

function driftedEdits(): ClipEditsV2 {
  return normalizeEdits(
    {
      ...defaultEdits(bounds),
      captionLines: [
        { id: 'a', text: 'Hello there', startMs: 5000, endMs: 5600 },
        { id: 'b', text: 'friends today', startMs: 5700, endMs: 6500 },
      ],
    },
    bounds,
  )
}

function inSyncEdits(): ClipEditsV2 {
  return normalizeEdits(
    {
      ...defaultEdits(bounds),
      captionLines: [
        { id: 'a', text: 'Hello there', startMs: 200, endMs: 1000 },
        { id: 'b', text: 'friends today', startMs: 1100, endMs: 2400 },
      ],
    },
    bounds,
  )
}

function renderDialog(edits: ClipEditsV2) {
  return render(
    <ExportDialog
      clipId="clip_sync"
      title="Sync clip"
      edits={edits}
      words={words}
      open
      onClose={() => {}}
      layoutMode={edits.layout.mode}
      facecamLayout={null}
      reframeV2Enabled={false}
      platform="twitch"
      defaultChannelUrl=""
    />,
  )
}

async function waitForExportReady(findByTestId: ReturnType<typeof render>['findByTestId']) {
  const btn = await findByTestId('export-mp4-button')
  await waitFor(() => {
    expect(btn.textContent).not.toMatch(/Checking/i)
  })
  return btn
}

describe('ExportDialog captionSyncAck and 409 CAPTION_SYNC_REQUIRED', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(exportClipWithOptions).mockResolvedValue({
      renderId: 'r1',
      downloadUrl: null,
      filename: 'clip.mp4',
      watermark: false,
      status: 'RUNNING',
    })
  })
  afterEach(() => {
    cleanup()
  })

  it('sends captionSyncAck: true on MP4 export after the user acknowledges the warning', async () => {
    const { findByTestId } = renderDialog(driftedEdits())
    const btn = await waitForExportReady(findByTestId)
    expect(await findByTestId('caption-sync-warning')).toBeTruthy()
    expect(btn).toHaveProperty('disabled', true)
    expect(exportClipWithOptions).not.toHaveBeenCalled()

    fireEvent.click(await findByTestId('caption-sync-export-ack'))
    await waitFor(() => {
      expect(btn).toHaveProperty('disabled', false)
    })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(exportClipWithOptions).toHaveBeenCalledTimes(1)
    })
    const body = vi.mocked(exportClipWithOptions).mock.calls[0]?.[1] as { captionSyncAck?: boolean }
    expect(body.captionSyncAck).toBe(true)
  })

  it('opens the sync warning on 409 CAPTION_SYNC_REQUIRED and retries only after the user acknowledges', async () => {
    const err = new FetchJsonError(
      'Caption timing looks out of sync. Acknowledge the warning to export anyway.',
      {
        status: 409,
        code: CAPTION_SYNC_REQUIRED,
        data: {
          warnings: [
            {
              level: 'warning',
              code: 'line_transcript_drift',
              message:
                'Caption timing has drifted from the transcript. Preview and export (burned-in and SRT) will not stay in sync until you fix the cues.',
            },
          ],
        },
      },
    )
    vi.mocked(exportClipWithOptions).mockRejectedValueOnce(err)

    const { findByTestId, queryByTestId } = renderDialog(inSyncEdits())
    const btn = await waitForExportReady(findByTestId)
    expect(queryByTestId('caption-sync-warning')).toBeNull()

    fireEvent.click(btn)
    await waitFor(() => {
      expect(exportClipWithOptions).toHaveBeenCalledTimes(1)
    })
    const firstBody = vi.mocked(exportClipWithOptions).mock.calls[0]?.[1] as {
      captionSyncAck?: boolean
    }
    expect(firstBody.captionSyncAck).toBeUndefined()

    const banner = await findByTestId('caption-sync-warning')
    expect(banner.textContent).toMatch(/out of sync/i)
    await waitFor(() => {
      expect(btn).toHaveProperty('disabled', true)
    })
    // No automatic retry — still exactly one request until the user acks and clicks again.
    expect(exportClipWithOptions).toHaveBeenCalledTimes(1)

    vi.mocked(exportClipWithOptions).mockResolvedValueOnce({
      renderId: 'r2',
      downloadUrl: null,
      filename: 'clip.mp4',
      watermark: false,
      status: 'RUNNING',
    })
    fireEvent.click(await findByTestId('caption-sync-export-ack'))
    await waitFor(() => {
      expect(btn).toHaveProperty('disabled', false)
    })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(exportClipWithOptions).toHaveBeenCalledTimes(2)
    })
    const retryBody = vi.mocked(exportClipWithOptions).mock.calls[1]?.[1] as {
      captionSyncAck?: boolean
    }
    expect(retryBody.captionSyncAck).toBe(true)
  })
})

// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { clipsFetch, getRenderStatus } from '@/lib/clips-api'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
}))
// Saved preference is 1080p — the in-flight render is 720p; the dialog must switch to 720p.
vi.mock('@/lib/clips/export-preferences-sync', () => ({
  loadMergedExportDialogPreferences: vi.fn(() =>
    Promise.resolve({ alsoSrt: false, exportSfx: 'off', defaultAspect: '16:9', defaultResolution: '1080p' }),
  ),
  persistExportDialogPreferences: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}))
vi.mock('@/lib/billing/entitlements', () => ({ can: vi.fn(() => true) }))

const bounds = { clipStartMs: 0, clipEndMs: 60000 }

function renderDialog() {
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  return render(
    <ExportDialog
      clipId="clip_fv4d"
      title="FV4d"
      edits={edits}
      open
      onClose={() => {}}
      layoutMode={edits.layout.mode}
      facecamLayout={null}
      reframeV2Enabled={false}
    />,
  )
}

function mockActive(renderRow: unknown, delayMs = 0) {
  vi.mocked(clipsFetch).mockImplementation(((path: string) =>
    path === '/api/clips/clips/clip_fv4d/active-render'
      ? new Promise((r) => setTimeout(() => r({ render: renderRow }), delayMs))
      : Promise.resolve({ channels: [] })) as unknown as typeof clipsFetch)
}

describe('FV4d ExportDialog follows the in-flight render settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRenderStatus).mockResolvedValue({
      id: 'rnd_720',
      status: 'RENDERING',
      downloadUrl: null,
      filename: 'x.mp4',
      error: null,
      progress: 6,
      phase: 'render_clip',
      etaSec: null,
      detail: null,
    })
  })
  afterEach(() => cleanup())

  it('shows Checking… while the lookup is pending, never a fresh Export MP4', async () => {
    mockActive({ id: 'rnd_720', status: 'RENDERING', resolution: '720p', aspectRatio: '16:9' }, 300)
    const { getByTestId } = renderDialog()
    expect(getByTestId('export-mp4-button').textContent).toBe('Checking…')
    expect((getByTestId('export-mp4-button') as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect(getByTestId('export-mp4-button').textContent).toBe('Rendering…'))
  })

  it('re-attaches to a 720p render even though 1080p is the saved default', async () => {
    mockActive({ id: 'rnd_720', status: 'RENDERING', resolution: '720p', aspectRatio: '16:9' })
    const { getByTestId, getByRole, queryByTestId, container } = renderDialog()
    await waitFor(() => expect(getByTestId('export-mp4-button').textContent).toBe('Rendering…'))
    expect((getByTestId('export-mp4-button') as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect(container.textContent).toMatch(/Rendering export… 6%/))
    // the preferences load (1080p) must not override the resumed selection
    await new Promise((r) => setTimeout(r, 20))
    expect(getByTestId('export-mp4-button').textContent).toBe('Rendering…')
    expect(queryByTestId('export-other-resolution-note')).toBeNull()

    // switching away from the running render's resolution allows another export, with a note
    fireEvent.click(getByRole('button', { name: '1080p' }))
    await waitFor(() => expect(getByTestId('export-mp4-button').textContent).toBe('Export MP4'))
    expect((getByTestId('export-mp4-button') as HTMLButtonElement).disabled).toBe(false)
    expect(getByTestId('export-other-resolution-note').textContent).toBe(
      'A 720p export is rendering — you can start another resolution.',
    )
    // and back to 720p blocks again
    fireEvent.click(getByRole('button', { name: '720p' }))
    await waitFor(() => expect(getByTestId('export-mp4-button').textContent).toBe('Rendering…'))
  })
})

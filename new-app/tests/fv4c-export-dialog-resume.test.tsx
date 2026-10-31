// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { clipsFetch, getRenderStatus } from '@/lib/clips-api'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
}))
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
      clipId="clip_fv4c"
      title="FV4c"
      edits={edits}
      open
      onClose={() => {}}
      layoutMode={edits.layout.mode}
      facecamLayout={null}
      reframeV2Enabled={false}
    />,
  )
}

describe('FV4c ExportDialog re-attaches to an in-flight render on open', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows Rendering… (disabled) and polls the in-flight render', async () => {
    vi.mocked(clipsFetch).mockImplementation(((path: string) =>
      Promise.resolve(
        path === '/api/clips/clips/clip_fv4c/active-render'
          ? { render: { id: 'rnd_live', status: 'RENDERING' } }
          : { channels: [] },
      )) as unknown as typeof clipsFetch,
    )
    vi.mocked(getRenderStatus).mockResolvedValue({
      id: 'rnd_live',
      status: 'RENDERING',
      downloadUrl: null,
      filename: 'x.mp4',
      error: null,
      progress: 42,
      phase: 'render_clip',
      etaSec: 300,
      detail: null,
    })
    const { getByTestId, container } = renderDialog()
    await waitFor(() => expect(getByTestId('export-mp4-button').textContent).toBe('Rendering…'))
    expect((getByTestId('export-mp4-button') as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect(getRenderStatus).toHaveBeenCalledWith('rnd_live'))
    await waitFor(() => expect(container.textContent).toMatch(/Rendering export… 42%/))
  })

  it('keeps a fresh Export MP4 when nothing is in flight', async () => {
    vi.mocked(clipsFetch).mockImplementation(((path: string) =>
      Promise.resolve(
        path === '/api/clips/clips/clip_fv4c/active-render' ? { render: null } : { channels: [] },
      )) as unknown as typeof clipsFetch,
    )
    const { getByTestId } = renderDialog()
    await waitFor(() =>
      expect(clipsFetch).toHaveBeenCalledWith('/api/clips/clips/clip_fv4c/active-render'),
    )
    expect(getByTestId('export-mp4-button').textContent).toBe('Export MP4')
    expect(getRenderStatus).not.toHaveBeenCalled()
  })
})

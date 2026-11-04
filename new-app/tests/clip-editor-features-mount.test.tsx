// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EditorShell } from '@/components/clips/editor/editor-shell'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'

vi.mock('next/font/google', () => ({
  Anton: () => ({ variable: '--font-clip-anton' }),
  Montserrat: () => ({ variable: '--font-clip-montserrat' }),
  Poppins: () => ({ variable: '--font-poppins' }),
  Bangers: () => ({ variable: '--font-clip-bangers' }),
  Bebas_Neue: () => ({ variable: '--font-clip-bebas' }),
  Archivo_Black: () => ({ variable: '--font-clip-archivo' }),
  Luckiest_Guy: () => ({ variable: '--font-clip-luckiest' }),
  Inter: () => ({ variable: '--font-clip-inter' }),
  Lato: () => ({ variable: '--font-clip-lato' }),
  Oswald: () => ({ variable: '--font-clip-oswald' }),
}))

vi.mock('@/components/shell/breadcrumb-context', () => ({
  useSetBreadcrumbTitle: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/app/clips/p/edit/c',
}))

vi.mock('@/components/clips/editor/use-full-video-highlights', () => ({
  useFullVideoHighlights: () => ({
    highlightsOn: false,
    hasPicks: false,
    ranges: [],
    picks: [],
    selectedClipId: null,
    highlightWordIdx: undefined,
    momentRows: undefined,
    setSelectedClipId: vi.fn(),
    onRangeChange: vi.fn(),
    onMakeClip: vi.fn(async () => {}),
    onOpenCard: vi.fn(),
  }),
}))

vi.mock('@/components/clips/editor/use-project-media', () => ({
  useMediaTranscripts: () => ({ transcripts: [] }),
  useProjectMedia: () => ({
    items: [],
    uploadFiles: vi.fn(async () => [{ refId: 'up1', ref: 'upload', id: 'm1', label: 'x', mediaType: 'audio' }]),
    refresh: vi.fn(),
  }),
  mediaUrlFor: vi.fn(),
}))

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn((url: string) => {
    if (String(url).includes('/versions')) return Promise.resolve({ items: [] })
    if (String(url).includes('export-user-preferences')) return Promise.resolve({ data: {} })
    if (String(url).includes('stock-audio/search')) return Promise.resolve({ available: true, hits: [] })
    if (String(url).includes('/clarity')) {
      return Promise.resolve({ proposals: [{ startMs: 1000, endMs: 2000, reason: 'tighten' }] })
    }
    return Promise.resolve({ channels: [] })
  }),
  patchClip: vi.fn(() => Promise.resolve({})),
  deriveClipFromEditor: vi.fn(),
  requestClipReframe: vi.fn(),
  saveClipBrandTemplate: vi.fn(),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
  createRenderShareLink: vi.fn(),
  revokeRenderShareLink: vi.fn(),
}))

vi.mock('@/components/clips/editor/use-generation', () => ({
  useGeneration: () => ({ status: 'IDLE', running: false, failed: false, downloadUrl: null, error: null }),
}))

vi.mock('@/components/clips/editor/use-dub-preview', () => ({
  useDubPreview: () => ({ dubs: [], dubLoading: false }),
}))

vi.mock('@/components/clips/editor/use-audio-mix', () => ({
  useAudioMix: () => ({ mix: null, mixLoading: false, refreshMix: vi.fn() }),
}))

vi.mock('@/components/clips/editor/use-studio-sound-preview', () => ({
  useStudioSoundPreview: () => ({
    studioPreviewUrl: null,
    studioPreviewState: 'idle',
    studioSlow: false,
    requestStudioPreview: vi.fn(),
  }),
}))

vi.mock('@/components/clips/editor/use-editor-words', () => ({
  useEditorWords: () => ({ words: [{ i: 0, w: 'hello', s: 0, e: 500 }], loading: false }),
}))

vi.mock('@/lib/clips/video-playback', () => ({
  playWithSound: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), message: vi.fn() },
}))

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 120_000 }

function loadFixture(name: string): ClipEditsV2 {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures/export-dialog-edits', name), 'utf8'))
  if (name === 'regular.json') return normalizeEdits(defaultEdits(bounds), bounds)
  return normalizeEdits(raw, bounds)
}

function renderShell(edits: ClipEditsV2) {
  return render(
    <EditorShell
      projectId="proj_mount"
      clipId="clip_mount"
      initialTitle="Mount test"
      bounds={bounds}
      initialEdits={edits}
      words={[{ i: 0, w: 'hello', s: 0, e: 500 }]}
      cropShots={[]}
      cropTrack={null}
      videoUrl={null}
    />,
  )
}

function clickRail(label: string, ui: ReturnType<typeof render>) {
  const rail = ui.getAllByTestId('editor-rail')[0]!
  fireEvent.click(within(rail).getByRole('button', { name: label }))
}

// Cleanup is a Script workspace tool, not a standalone EditorRail group.
function openScriptCleanup(ui: ReturnType<typeof render>) {
  fireEvent.click(ui.getByTestId('editor-layout-view-script'))
  const tabs = ui.getByTestId('script-view-tool-tabs')
  fireEvent.click(within(tabs).getByRole('button', { name: 'Clean up' }))
}

describe('clip editor feature mounts (EditorShell)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('Cleanup: clarity flow opens from Edit for clarity', async () => {
    const ui = renderShell(loadFixture('regular.json'))
    openScriptCleanup(ui)
    fireEvent.click(ui.getByTestId('clarity-run'))
    await waitFor(() => expect(clipsFetch).toHaveBeenCalledWith('/api/clips/clips/clip_mount/clarity', expect.any(Object)))
    await waitFor(() => expect(ui.getByTestId('clarity-apply-all')).toBeTruthy())
    expect(ui.getByTestId('clarity-proposal')).toBeTruthy()
  })

  it('Cleanup: Remove retakes control is visible', () => {
    const ui = renderShell(loadFixture('regular.json'))
    openScriptCleanup(ui)
    expect(ui.getByTestId('retake-run')).toBeTruthy()
  })

  it('mounts each Script tool once, including after switching tools', () => {
    const ui = renderShell(loadFixture('regular.json'))
    openScriptCleanup(ui)
    expect(ui.getAllByTestId('clarity-run')).toHaveLength(1)
    expect(ui.getAllByTestId('retake-run')).toHaveLength(1)
    expect(ui.getByTestId('editor-grid').querySelectorAll('[data-region="panel"]')).toHaveLength(0)

    fireEvent.click(ui.getByTestId('script-tool-text'))
    expect(ui.getAllByTestId('editor-panel-text')).toHaveLength(1)
    expect(ui.getByTestId('editor-grid').querySelectorAll('[data-region="panel"]')).toHaveLength(0)

    fireEvent.click(ui.getByTestId('script-tool-audio'))
    expect(ui.getAllByTestId('audio-music-sfx-mix')).toHaveLength(1)
    expect(ui.getByTestId('editor-grid').querySelectorAll('[data-region="panel"]')).toHaveLength(0)
  })

  it('Text: voiceover preview control on selected text item', async () => {
    const blob = new Blob(['x'], { type: 'audio/mpeg' })
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(blob),
        }),
      ),
    )
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        textItems: [
          {
            id: 't1',
            text: 'Voice line',
            startMs: 500,
            endMs: 3000,
            x: 50,
            y: 50,
            style: { font: 'Montserrat', size: 48, color: '#FFFFFF', align: 'center' as const },
          },
        ],
      },
      bounds,
    )
    const ui = renderShell(edits)
    clickRail('Text', ui)
    const panel = ui.getByTestId('editor-panel-text')
    fireEvent.click(within(panel).getByTestId('text-list-item-t1'))
    await waitFor(() => expect(within(panel).getByTestId('text-voiceover-preview')).toBeTruthy())
    fireEvent.click(within(panel).getByTestId('text-voiceover-preview'))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/clips/clips/clip_mount/voiceover', expect.any(Object)))
    vi.unstubAllGlobals()
  })

  it('Audio: Music, SFX & mix section with suggest and beat cut UI', () => {
    const ui = renderShell(loadFixture('regular.json'))
    clickRail('Audio', ui)
    expect(ui.getByTestId('audio-music-sfx-mix')).toBeTruthy()
    expect(ui.getByTestId('audio-music-suggest')).toBeTruthy()
    expect(ui.getByTestId('audio-beat-cut')).toBeTruthy()
    expect(ui.getAllByTestId('stock-sfx-license-badge').length).toBeGreaterThan(0)
  })

  it('Export dialog: XML and stems when export opens', () => {
    const ui = renderShell(loadFixture('regular.json'))
    fireEvent.click(ui.getByRole('button', { name: /Export/i }))
    const dialog = ui.getByTestId('export-dialog')
    expect(within(dialog).getByTestId('export-xml-download')).toBeTruthy()
    expect(within(dialog).getByTestId('export-stems-main')).toBeTruthy()
  })
})

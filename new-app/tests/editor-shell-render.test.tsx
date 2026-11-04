// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EditorShell } from '@/components/clips/editor/editor-shell'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { clip5f19e510Edits } from '@/tests/fixtures/clip-5f19e510-edits'

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

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn((url: string) => {
    if (String(url).includes('/versions')) {
      return Promise.resolve({ items: [] })
    }
    if (String(url).includes('export-user-preferences')) {
      return Promise.resolve({ data: {} })
    }
    return Promise.resolve({ channels: [] })
  }),
  patchClip: vi.fn(() => Promise.resolve({})),
  deriveClipFromEditor: vi.fn(),
  requestClipReframe: vi.fn(),
  saveClipBrandTemplate: vi.fn(),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
}))

vi.mock('@/components/clips/editor/use-project-media', () => ({
  useMediaTranscripts: () => ({ transcripts: [] }),
  useProjectMedia: () => ({
    items: [],
    uploads: [],
    loading: false,
    uploadFiles: vi.fn(),
    refresh: vi.fn(),
  }),
  mediaUrlFor: vi.fn(),
}))

vi.mock('@/components/clips/editor/use-generation', async (importOriginal) => importOriginal())

vi.mock('@/components/clips/editor/use-dub-preview', () => ({
  useDubPreview: () => ({ dubs: [], dubLoading: false }),
}))

vi.mock('@/components/clips/editor/use-audio-mix', () => ({
  useAudioMix: () => ({
    mix: null,
    mixLoading: false,
    refreshMix: vi.fn(),
  }),
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
  useEditorWords: () => ({
    words: [{ i: 0, w: 'hello', s: 0, e: 500 }],
    wordsLoading: false,
    reloadWords: vi.fn(),
  }),
}))

vi.mock('@/lib/clips/video-playback', () => ({
  playWithSound: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

const bounds = { clipStartMs: 0, clipEndMs: 60000, trimMinMs: 0, trimMaxMs: 120000 }

function loadFixture(name: string): ClipEditsV2 {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures/export-dialog-edits', name), 'utf8'))
  if (name === 'regular.json') {
    return normalizeEdits(defaultEdits(bounds), bounds)
  }
  return normalizeEdits(raw, bounds)
}

describe('EditorShell render smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    cleanup()
    await new Promise<void>((resolve) => {
      setImmediate(() => resolve())
    })
  })

  it('mounts with regular fixture edits (useEditorState + shell imports resolve)', async () => {
    const edits = loadFixture('regular.json')
    const { getByTestId } = render(
      <EditorShell
        projectId="proj_test"
        clipId="clip_test"
        initialTitle="Test clip"
        bounds={bounds}
        initialEdits={edits}
        words={[{ i: 0, w: 'hello', s: 0, e: 500 }]}
        cropShots={[]}
        cropTrack={null}
        videoUrl={null}
      />,
    )
    // The unified editor no longer mounts an invisible Layout picker inside a legacy panel.
    // Verify the actual transcript/preview/timeline workspace and retained top menu instead.
    expect(getByTestId('unified-editor-workspace')).toBeTruthy()
    expect(getByTestId('unified-transcript-pane')).toBeTruthy()
    expect(getByTestId('unified-video-preview')).toBeTruthy()
    expect(getByTestId('unified-timeline-region')).toBeTruthy()
    expect(document.querySelector('[data-testid="transcript-find-replace"]')).toBeNull()
    expect(document.querySelector('[data-testid="transcript-para-time"]')).toBeNull()
    expect(getByTestId('editor-workspace-controls')).toBeTruthy()
    expect(getByTestId('unified-top-bar-modes')).toBeTruthy()
    expect(getByTestId('editor-workspace-controls').contains(getByTestId('unified-mode-expanded'))).toBe(true)
    expect(document.querySelector('[data-testid="unified-workspace-toolbar"] [data-testid^="unified-mode-"]')).toBeNull()
    expect(getByTestId('versions-menu')).toBeTruthy()
    const topBar = getByTestId('editor-top-bar')
    const menus = getByTestId('editor-top-bar-left')
    const project = getByTestId('editor-top-bar-project')
    const saved = getByTestId('editor-top-bar-save')
    expect(topBar.contains(menus)).toBe(true)
    expect(topBar.contains(project)).toBe(true)
    expect(menus.compareDocumentPosition(project) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(project.compareDocumentPosition(saved) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(getByTestId('editor-menu-file')).toBeTruthy()
    expect(getByTestId('editor-menu-audio')).toBeTruthy()
    expect(getByTestId('editor-menu-help')).toBeTruthy()
    expect(topBar.querySelector('[data-testid="layout-menu"]')).toBeNull()
    expect(topBar.querySelector('[data-testid="editor-highlights-toggle"]')).toBeNull()
    expect(topBar.querySelector('[data-testid="versions-menu"]')).toBeNull()
    await waitFor(() => {
      expect(document.body).toBeTruthy()
    })
  })

  it('mounts BYO clip fixture (source media, no crop track, no preview)', () => {
    const edits = loadFixture('byo_clip.json')
    expect(() =>
      render(
        <EditorShell
          projectId="proj_byo"
          clipId="clip_byo"
          initialTitle="BYO short"
          bounds={{ clipStartMs: 0, clipEndMs: 28000, trimMinMs: 0, trimMaxMs: 28000 }}
          initialEdits={edits}
          words={[{ i: 0, w: 'hello', s: 0, e: 500 }]}
          cropShots={[]}
          cropTrack={null}
          videoUrl="https://example.com/source.mp4"
          editorMedia={{ kind: 'source', url: 'https://example.com/source.mp4', offsetMs: 0 }}
        />,
      ),
    ).not.toThrow()
  })

  it('mounts clip_5f19e510 prod fixture (useGeneration import resolves)', async () => {
    const bounds = { clipStartMs: 0, clipEndMs: 32_000, trimMinMs: 0, trimMaxMs: 32_000 }
    const edits = clip5f19e510Edits()
    const view = render(
      <EditorShell
        projectId="proj_c6f4de920dc54c55b9d10cccf43f5348"
        clipId="clip_5f19e510a23241c29190475d4723aa21"
        initialTitle="Prod fixture"
        bounds={bounds}
        initialEdits={edits}
        words={[{ i: 0, w: 'hello', s: 0, e: 0.5 }]}
        cropShots={[{ startMs: 0, endMs: 32_000, speaker: 'A', cx: 30, cy: 45, w: 100, h: 100 }]}
        cropTrack={null}
        videoUrl="https://example.com/preview.mp4"
      />,
    )
    await waitFor(() => {
      expect(view.getAllByTestId('timeline-root').length).toBeGreaterThan(0)
    })
  })
})

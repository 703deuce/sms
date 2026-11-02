// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EditorShell } from '@/components/clips/editor/editor-shell'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

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
    if (String(url).includes('/versions')) return Promise.resolve({ items: [] })
    if (String(url).includes('export-user-preferences')) return Promise.resolve({ data: {} })
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

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 120_000 }

function loadRegularEdits(): ClipEditsV2 {
  const raw = JSON.parse(readFileSync(join(import.meta.dirname, '../fixtures/export-dialog-edits/regular.json'), 'utf8'))
  return normalizeEdits(defaultEdits(bounds), bounds)
}

describe('wide properties column (UI_fix3)', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600, writable: true })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows properties-empty before inspector tab is visited', async () => {
    const edits = loadRegularEdits()
    const view = render(
      <EditorShell
        projectId="proj_wide_props"
        clipId="clip_wide_props"
        initialTitle="Wide props"
        bounds={bounds}
        initialEdits={edits}
        words={[{ i: 0, w: 'hello', s: 0, e: 500 }]}
        cropShots={[]}
        cropTrack={null}
        videoUrl={null}
      />,
    )
    await waitFor(() => {
      expect(view.getByTestId('editor-grid').getAttribute('data-band')).toBe('wide')
    })
    expect(view.getByTestId('properties-empty')).toBeTruthy()
  })
})

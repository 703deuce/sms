/**
 * SSR smoke: clip editor page must not throw during React render (TDZ / hook ordering).
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { EditorShell } from '@/components/clips/editor/editor-shell'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

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
  clipsFetch: vi.fn(() => Promise.resolve({ items: [] })),
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
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), message: vi.fn() },
}))

const bounds = { clipStartMs: 0, clipEndMs: 32_000, trimMinMs: 0, trimMaxMs: 32_000 }

describe('EditorShell SSR', () => {
  it('renderToString does not hit editorWords TDZ (#946 regression)', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    expect(() =>
      renderToString(
        <EditorShell
          projectId="proj_c6f4de920dc54c55b9d10cccf43f5348"
          clipId="clip_5f19e510a23241c29190475d4723aa21"
          initialTitle="SSR smoke"
          bounds={bounds}
          initialEdits={edits}
          words={[{ i: 0, w: 'hello', s: 0, e: 0.5 }]}
          cropShots={[]}
          cropTrack={null}
          videoUrl="https://example.com/preview.mp4"
        />,
      ),
    ).not.toThrow()
  })
})

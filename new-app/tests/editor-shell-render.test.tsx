// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
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

vi.mock('@/components/clips/editor/use-generation', () => ({
  useGeneration: () => ({
    gen: null,
    brollMedia: [],
    refreshBroll: vi.fn(),
  }),
}))

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
  useEditorWords: () => ({ words: [{ i: 0, w: 'hello', s: 0, e: 500 }], loading: false }),
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

  it('mounts with regular fixture edits (useEditorState + shell imports resolve)', () => {
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
    expect(getByTestId('layout-quick-picker')).toBeTruthy()
    expect(getByTestId('versions-menu')).toBeTruthy()
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
})

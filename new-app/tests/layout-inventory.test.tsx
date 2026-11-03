// @vitest-environment happy-dom
/**
 * Layout revamp guard: every catalogued control stays discoverable after UI moves.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import inventory from '@/lib/clips/editor/layout-control-inventory.generated.json'
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
    if (String(url).includes('/clarity')) return Promise.resolve({ proposals: [] })
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

const PHASE1_DOM_IDS = [
  'timeline-toolbar',
  'timeline-tool-trigger',
  'timeline-tools',
  'timeline-tool-select',
  'timeline-tool-blade',
  'timeline-tool-roll',
  'timeline-tool-slide',
  'timeline-tool-slip',
  'timeline-tool-hand',
  'timeline-j-cut',
  'timeline-l-cut',
  'timeline-nudge',
  'timeline-split',
  'timeline-delete',
  'timeline-freeze',
  'timeline-snap',
  'timeline-magnet',
  'timeline-link-overlays',
  'timeline-auto-xfade',
  'timeline-more-menu',
  'timeline-gap',
  'timeline-takes-menu',
  'timeline-xfade-tracks',
  'timeline-add-track',
  'timeline-pacing',
  'timeline-envelopes',
  'timeline-add-marker',
  'timeline-markers-list',
  'timeline-loop',
  'timeline-preview-rate',
  'timeline-preview-rate-1',
  'timeline-shortcuts',
  'timeline-palette',
  'timeline-zoom-out',
  'timeline-zoom-in',
  'timeline-zoom-slider',
  'timeline-zoom-label',
  'timeline-zoom-fit',
  'timeline-help',
  'timeline-help-popover',
  'preview-transport-strip',
  'preview-view-menu',
  'preview-fullscreen',
  'preview-quality',
  'preview-meter-toggle',
  'preview-chip-row',
]

function collectEditorSources(): string {
  const roots = ['components/clips/editor', 'components/clips']
  let blob = ''
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx|ts)$/.test(f)) blob += readFileSync(p, 'utf8')
    }
  }
  for (const r of roots) walk(join(process.cwd(), r))
  return blob
}

const RAIL_ARIA: Record<string, string> = {
  Audio: 'Audio',
  'B-roll': 'B-roll',
  Brand: 'Brand',
  Captions: 'Captions',
  Cleanup: 'Cleanup',
  Color: 'Color',
  Cover: 'Cover',
  Dub: 'Dub',
  Layers: 'Layers',
  Media: 'Media',
  Polish: 'Polish',
  Properties: 'Properties',
  Repurpose: 'Repurpose',
  Script: 'Script',
  Templates: 'Templates',
  Text: 'Text',
}

function loadFixture(name: string): ClipEditsV2 {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures/export-dialog-edits', name), 'utf8'))
  let edits: ClipEditsV2
  if (name === 'regular.json') edits = normalizeEdits(defaultEdits(bounds), bounds)
  else edits = normalizeEdits(raw, bounds)
  if (name === 'stream_v3_clipB.json') {
    edits = {
      ...edits,
      trim: { in: (edits.trim?.in ?? 0) + 500, out: (edits.trim?.out ?? bounds.clipEndMs) - 500 },
    }
  }
  return edits
}

function renderShell(editsName = 'stream_v3_clipB.json') {
  return render(
    <EditorShell
      projectId="proj_layout"
      clipId="clip_layout"
      initialTitle="Layout inventory"
      bounds={bounds}
      initialEdits={loadFixture(editsName)}
      words={[{ i: 0, w: 'hello', s: 0, e: 500 }]}
      cropShots={[]}
      cropTrack={null}
      videoUrl={null}
    />,
  )
}

const PHASE2_DOM_IDS = [
  'editor-repurpose-open',
  'editor-panel-resize-handle',
  'transcript-more-menu',
  'properties-project-settings',
  'properties-project-duration',
  'editor-rail-group-script',
  'editor-rail-group-captions',
  'editor-rail-group-text',
  'editor-rail-group-media',
  'editor-rail-group-audio',
  'editor-rail-group-effects',
  'editor-rail-group-layers',
  'editor-rail-group-templates',
]

describe('layout inventory (Phase 1–2 guard)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it(`catalogues ${inventory.count} controls in source`, () => {
    const blob = collectEditorSources()
    const missing: string[] = []
    for (const { testId } of inventory.entries) {
      const dynamicOk = testId === 'timeline-j-cut' || testId === 'timeline-l-cut' || /^timeline-preview-rate-/.test(testId)
      if (!dynamicOk && !blob.includes(testId)) missing.push(testId)
    }
    expect(missing).toEqual([])
  })

  it('Phase 1 moved controls stay discoverable when menus are open', async () => {
    const ui = renderShell()
    await waitFor(() => expect(ui.getByTestId('timeline-root')).toBeTruthy())
    fireEvent.click(ui.getByTestId('timeline-tool-trigger'))
    fireEvent.click(ui.getByTestId('timeline-more-menu'))
    fireEvent.click(ui.getByTestId('preview-view-menu'))
    const missing = PHASE1_DOM_IDS.filter((id) => !ui.queryAllByTestId(id).length)
    expect(missing).toEqual([])
  })

  it('Phase 2 chrome controls stay discoverable in the shell', async () => {
    vi.stubGlobal('innerWidth', 1680)
    const ui = renderShell()
    await waitFor(() => expect(ui.getByTestId('timeline-root')).toBeTruthy())
    fireEvent.click(ui.getByTestId('editor-repurpose-open'))
    for (const g of ['script', 'captions', 'text', 'media', 'audio', 'effects', 'layers', 'templates'] as const) {
      fireEvent.click(ui.getAllByTestId(`editor-rail-group-${g}`)[0]!)
    }
    fireEvent.click(ui.getAllByTestId('editor-rail-group-script')[0]!)
    await waitFor(() => expect(ui.getByTestId('transcript-more-menu')).toBeTruthy())
    fireEvent.click(ui.getByTestId('transcript-more-menu'))
    const missing = PHASE2_DOM_IDS.filter((id) => !ui.queryAllByTestId(id).length)
    expect(missing).toEqual([])
  })
})

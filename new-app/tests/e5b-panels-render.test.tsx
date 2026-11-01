// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import { mediaWordIndex, type MediaTranscript } from '@/lib/clips/editor/media-words'
vi.mock('@/lib/clips/upload', () => ({ uploadClipFile: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }))
import { MediaLibraryGrid, MediaPanel } from '@/components/clips/editor/media-panel'
import { TimelineInsertMarkers } from '@/components/clips/editor/timeline-insert-markers'
import { InsertPlayback } from '@/components/clips/editor/insert-playback'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]![0] as ClipEditsV2
const click = async (el: Element) => {
  await act(async () => void fireEvent.click(el))
}

function item(p: Partial<ProjectMediaItem> & Pick<ProjectMediaItem, 'id' | 'mediaType'>): ProjectMediaItem {
  return {
    ref: 'upload',
    refId: p.id,
    label: p.id,
    durationMs: p.mediaType === 'image' ? null : 8000,
    width: 1920,
    height: 1080,
    url: `https://cdn.test/${p.id}`,
    syncMs: null,
    syncStatus: 'none',
    ...p,
  } as ProjectMediaItem
}
const items = [item({ id: 'upl_v', mediaType: 'video' }), item({ id: 'upl_i', mediaType: 'image' }), item({ id: 'upl_a', mediaType: 'audio' })]
function api(extra: Partial<ProjectMediaApi> = {}): ProjectMediaApi {
  return {
    items,
    loading: false,
    error: null,
    uploads: [],
    refresh: vi.fn(),
    uploadFiles: vi.fn(),
    remove: vi.fn(async () => {}),
    syncAudio: vi.fn(async () => {}),
    dismissUpload: vi.fn(),
    transcripts: [],
    estimateTranscript: vi.fn(async () => ({ ref: 'upload', refId: 'upl_v', durationMs: 95_000, durationKnown: true, credits: 2 })),
    transcribe: vi.fn(async () => {}),
    ...extra,
  } as unknown as ProjectMediaApi
}

afterEach(() => cleanup())

describe('E5b library card', () => {
  it('Insert / Append only on visual media', async () => {
    const onInsert = vi.fn()
    const t = render(<MediaLibraryGrid media={api()} onAdd={vi.fn()} onInsert={onInsert} />)
    const cards = t.getAllByTestId('media-item')
    expect(cards[2]!.querySelector('[data-testid="media-insert"]')).toBeNull()
    await click(cards[0]!.querySelector('[data-testid="media-insert"]')!)
    expect(onInsert).toHaveBeenLastCalledWith(items[0], 'insert')
    await click(cards[1]!.querySelector('[data-testid="media-append"]')!)
    expect(onInsert).toHaveBeenLastCalledWith(items[1], 'append')
  })

  it('Transcribe shows the cost first and runs only after confirming it', async () => {
    const m = api()
    const t = render(<MediaLibraryGrid media={m} onAdd={vi.fn()} />)
    expect(t.getAllByTestId('media-transcribe')).toHaveLength(1) // video only (not image / audio)
    await click(t.getByTestId('media-transcribe'))
    expect(m.estimateTranscript).toHaveBeenCalledWith(items[0])
    expect(m.transcribe).not.toHaveBeenCalled()
    expect(t.getByTestId('media-transcribe-confirm').textContent).toContain('1:35')
    expect(t.getByTestId('media-transcribe-cost').textContent).toBe('2 credits')
    expect(t.getByTestId('media-transcribe-confirm').textContent).not.toContain('$')
    await click(t.getByTestId('media-transcribe-run'))
    expect(m.transcribe).toHaveBeenCalledWith(items[0], 2)
  })

  it('shows progress / word count from the transcript row', () => {
    const tr = (status: MediaTranscript['status']) =>
      [{ id: 't', ref: 'upload', refId: 'upl_v', status, words: status === 'done' ? [{ w: 'a', s: 0, e: 1 }] : [] }] as unknown as MediaTranscript[]
    const t = render(<MediaLibraryGrid media={api({ transcripts: tr('running') })} onAdd={vi.fn()} />)
    expect(t.getByTestId('media-transcript-running')).toBeTruthy()
    cleanup()
    const d = render(<MediaLibraryGrid media={api({ transcripts: tr('done') })} onAdd={vi.fn()} />)
    expect(d.getByTestId('media-transcript-done').textContent).toContain('1 words')
  })
})

describe('E5b Media panel inserts', () => {
  const panel = (e: ClipEditsV2, onEdits: ReturnType<typeof vi.fn>, m = api()) =>
    render(
      <MediaPanel
        projectId="proj_test"
        media={m}
        edits={e}
        words={[]}
        selectedVideo={null}
        selectedSegmentId={null}
        onSelectSegment={vi.fn()}
        onAdd={vi.fn()}
        onReplaceSelected={vi.fn()}
        onEdits={onEdits}
        playheadSourceMs={5000}
        onSeekSource={vi.fn()}
      />,
    )

  it('Insert at the playhead adds a rippling insert', async () => {
    const onEdits = vi.fn()
    const t = panel(base(), onEdits)
    await click(t.getAllByTestId('media-insert')[0]!)
    expect(last(onEdits).inserts).toEqual([{ id: expect.any(String), sourceId: 'upl_v', atSrcMs: 5000, inMs: 0, durMs: 8000 }])
  })

  it('lists inserts: sound, remove (prunes the source) and editable words', async () => {
    const e = base({
      sources: [{ id: 'upl_v', ref: 'upload', refId: 'upl_v', mediaType: 'video', durationMs: 8000 }],
      inserts: [{ id: 'a', sourceId: 'upl_v', atSrcMs: 5000, inMs: 0, durMs: 2000 }],
    })
    const tr = [{ id: 't', ref: 'upload', refId: 'upl_v', status: 'done', words: [{ w: 'hello', s: 0.2, e: 0.5 }] }] as unknown as MediaTranscript[]
    const onEdits = vi.fn()
    const t = panel(e, onEdits, api({ transcripts: tr }))
    expect(t.getAllByTestId('media-insert-row')).toHaveLength(1)
    await click(t.getByTestId('media-insert-audio-mute'))
    expect(last(onEdits).inserts![0]!.audio).toBe('mute')
    const input = t.getByTestId('media-insert-words').querySelector('input')!
    expect(input.value).toBe('hello')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello!' } })
      fireEvent.blur(input)
    })
    expect(last(onEdits).wordFixes).toEqual({ [String(mediaWordIndex('upl_v', 0))]: 'Hello!' })
    await click(t.getByTestId('media-insert-remove'))
    expect(last(onEdits).inserts).toBeUndefined()
    expect(last(onEdits).sources ?? []).toHaveLength(0)
  })
})

describe('E5b timeline markers', () => {
  it('marks each insert point with its length', () => {
    const t = render(
      <TimelineInsertMarkers
        tb={{ segs: [[0, 20_000]] }}
        inserts={[{ id: 'a', sourceId: 'upl_v', atSrcMs: 5000, inMs: 0, durMs: 2500 }]}
        sources={[{ id: 'upl_v', ref: 'upload', refId: 'upl_v', mediaType: 'video', label: 'drone.mp4' }]}
        pxPerMs={0.1}
      />,
    )
    const m = t.getByTestId('timeline-insert-marker')
    expect(m.textContent).toContain('+2.5s')
    expect(m.getAttribute('style')).toContain('left: 500px')
  })
})

describe('E5b preview insert layer', () => {
  it('mounts a hidden overlay only when the clip has inserts', () => {
    const ref = { current: null }
    const none = render(<InsertPlayback videoRef={ref} edits={base()} words={[]} />)
    expect(none.queryByTestId('preview-insert')).toBeNull()
    cleanup()
    const e = base({
      sources: [{ id: 'upl_v', ref: 'upload', refId: 'upl_v', mediaType: 'video', durationMs: 8000 }],
      inserts: [{ id: 'a', sourceId: 'upl_v', atSrcMs: 5000, inMs: 0, durMs: 2000 }],
    })
    const t = render(<InsertPlayback videoRef={ref} edits={e} words={[]} sourceUrls={{ upl_v: 'https://cdn.test/upl_v' }} />)
    const layer = t.getByTestId('preview-insert')
    expect(layer.style.visibility).toBe('hidden')
    expect(layer.querySelector('video')?.getAttribute('data-own-clock')).toBe('1')
  })
})

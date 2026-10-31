// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { ProjectMediaApi } from '@/components/clips/editor/use-project-media'
// The upload transport (tus / multipart) is not exercised here.
vi.mock('@/lib/clips/upload', () => ({ uploadClipFile: vi.fn() }))
import { MediaLibraryGrid, MediaPanel } from '@/components/clips/editor/media-panel'
import { BrollPanel } from '@/components/clips/editor/broll-panel'
import { Timeline } from '@/components/clips/editor/timeline'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]![0] as ClipEditsV2
const click = (el: Element) => act(() => void fireEvent.click(el))

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
const items = [
  item({ id: 'upl_v', mediaType: 'video' }),
  item({ id: 'upl_i', mediaType: 'image' }),
  item({ id: 'upl_a', mediaType: 'audio' }),
]
function api(list = items): ProjectMediaApi {
  return {
    items: list,
    loading: false,
    error: null,
    uploads: [],
    refresh: vi.fn(),
    uploadFiles: vi.fn(),
    remove: vi.fn(async () => {}),
    syncAudio: vi.fn(async () => {}),
    dismissUpload: vi.fn(),
  } as unknown as ProjectMediaApi
}

afterEach(() => cleanup())

describe('Media library grid', () => {
  it('shows thumbnails, durations and per-lane add buttons that fit the media type', () => {
    const onAdd = vi.fn()
    const t = render(<MediaLibraryGrid media={api()} onAdd={onAdd} />)
    const cards = t.getAllByTestId('media-item')
    expect(cards.map((c) => c.getAttribute('data-media-type'))).toEqual(['video', 'image', 'audio'])
    expect(cards[0]!.textContent).toContain('0:08')
    expect(cards[0]!.querySelectorAll('[data-testid^="media-add-"]').length).toBe(2) // Video, B-roll
    expect(cards[2]!.querySelector('[data-testid="media-add-video"]')).toBeNull()
    click(cards[2]!.querySelector('[data-testid="media-add-music"]')!)
    expect(onAdd).toHaveBeenLastCalledWith(items[2], 'music')
    expect(cards[0]!.getAttribute('draggable')).toBe('true')
  })

  it("B-roll Upload tab variant shows only visuals with a B-roll button", () => {
    const onAdd = vi.fn()
    const t = render(<MediaLibraryGrid media={api()} filter="visual" lanes={['broll']} onAdd={onAdd} compact />)
    expect(t.getAllByTestId('media-item')).toHaveLength(2)
    expect(t.queryByTestId('media-add-video')).toBeNull()
    click(t.getAllByTestId('media-add-broll')[1]!)
    expect(onAdd).toHaveBeenLastCalledWith(items[1], 'broll')
  })
})

describe('Media panel', () => {
  it('segment editor patches sound / fit and removes the segment', () => {
    const e = base({
      sources: [{ id: 's1', ref: 'upload', refId: 'upl_v', mediaType: 'video' }],
      sourceSegments: [{ id: 'g1', sourceId: 's1', startMs: 2000, endMs: 5000, inMs: 0 }],
    })
    const onEdits = vi.fn()
    const onSelect = vi.fn()
    const t = render(
      <MediaPanel
        media={api()}
        edits={e}
        words={[]}
        selectedVideo={null}
        selectedSegmentId="g1"
        onSelectSegment={onSelect}
        onAdd={vi.fn()}
        onReplaceSelected={vi.fn()}
        onEdits={onEdits}
        playheadSourceMs={3000}
      />,
    )
    expect(t.getByTestId('media-segment-editor')).toBeTruthy()
    click(t.getByTestId('media-seg-audio-main'))
    expect(last(onEdits).sourceSegments![0]!.audio).toBe('main')
    click(t.getByTestId('media-seg-fit-contain'))
    expect(last(onEdits).sourceSegments![0]!.fit).toBe('contain')
    click(t.getByTestId('media-seg-remove'))
    expect(last(onEdits).sourceSegments ?? []).toHaveLength(0)
    expect(last(onEdits).sources ?? []).toHaveLength(0)
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })
})

describe('B-roll panel Upload tab', () => {
  it('renders the slot next to Stock and AI', () => {
    const t = render(
      <BrollPanel
        clipId="c1"
        edits={base()}
        outputDurationMs={20000}
        playheadMs={0}
        aiMeta={null}
        brollMedia={[]}
        onMergeBroll={vi.fn()}
        onSetBroll={vi.fn()}
        onRemoveBroll={vi.fn()}
        onBrollMedia={vi.fn()}
        onFlushEdits={vi.fn()}
        uploadSlot={<div data-testid="slot">library</div>}
      />,
    )
    click(t.getByTestId('broll-tab-upload'))
    expect(t.getByTestId('slot')).toBeTruthy()
  })
})

describe('Timeline (E5)', () => {
  const props = {
    words: [],
    shots: [],
    outputMs: 0,
    clipOutputDurationMs: 20000,
    onSeekOutput: vi.fn(),
    clipStartMs: 0,
    clipEndMs: 20000,
    trimMinMs: 0,
    trimMaxMs: 40000,
    onCommitEdits: vi.fn(),
  }
  it('draws source segment chips on the Video lane and opens them on click', () => {
    const onSel = vi.fn()
    const e = base({
      sources: [{ id: 's1', ref: 'upload', refId: 'upl_v', mediaType: 'video', label: 'Cam B' }],
      sourceSegments: [{ id: 'g1', sourceId: 's1', startMs: 2000, endMs: 5000 }],
    })
    const t = render(<Timeline {...props} edits={e} onSelectSourceSegment={onSel} />)
    const chip = t.getByTestId('timeline-source-segment')
    expect(chip.getAttribute('data-source-id')).toBe('s1')
    click(chip)
    expect(onSel).toHaveBeenCalledWith('g1')
  })
  it('accepts a media drop on a lane', () => {
    const onDrop = vi.fn()
    const t = render(<Timeline {...props} edits={base()} onDropMedia={onDrop} />)
    const lane = t.getByTestId('timeline-lane-video')
    const dt = { types: ['application/x-clip-media'], getData: () => 'upl_v', dropEffect: '' }
    act(() => void fireEvent.drop(lane, { dataTransfer: dt, clientX: 0 }))
    expect(onDrop).toHaveBeenCalled()
    expect(onDrop.mock.calls[0]![0]).toBe('video')
    expect(onDrop.mock.calls[0]![2]).toBe('upl_v')
  })
})

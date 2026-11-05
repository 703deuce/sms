// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { CanvasSelectionOverlay, type CanvasLayerDom } from '@/components/clips/editor/canvas-selection-overlay'
import { PropertiesPanel, tabsFor } from '@/components/clips/editor/properties-panel'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { findTrack } from '@/lib/clips/editor/keyframes'
import { layerFlip, layerZ } from '@/lib/clips/editor/layer-props'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch })

function rect(el: HTMLElement, r: { x: number; y: number; w: number; h: number }) {
  el.getBoundingClientRect = () => ({ left: r.x, top: r.y, width: r.w, height: r.h, right: r.x + r.w, bottom: r.y + r.h, x: r.x, y: r.y, toJSON: () => ({}) }) as DOMRect
  Object.defineProperty(el, 'clientWidth', { value: r.w, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: r.h, configurable: true })
}

function stage(e: ClipEditsV2, opts: { cropMode?: boolean; selected?: string | null } = {}) {
  const box = document.createElement('div')
  document.body.appendChild(box)
  rect(box, { x: 0, y: 0, w: 200, h: 400 })
  const mainKf = document.createElement('div')
  mainKf.style.transformOrigin = '50% 50%'
  box.appendChild(mainKf)
  // text item layer (frame-sized) with a 100 x 40 block centred at (100, 100)
  const tl = document.createElement('div')
  tl.style.transformOrigin = '50% 25%'
  box.appendChild(tl)
  const block = document.createElement('div')
  block.style.transform = 'translate(-50%, -50%)'
  Object.defineProperty(block, 'offsetLeft', { value: 100 })
  Object.defineProperty(block, 'offsetTop', { value: 100 })
  Object.defineProperty(block, 'offsetWidth', { value: 100 })
  Object.defineProperty(block, 'offsetHeight', { value: 40 })
  tl.appendChild(block)
  const layers: CanvasLayerDom[] = [
    { target: 'video', el: mainKf, frame: box },
    { target: 'text:t1', el: tl, frame: box, content: block },
  ]
  const onSelect = vi.fn()
  const onCommit = vi.fn()
  const onCrop = vi.fn()
  const utils = render(
    <CanvasSelectionOverlay
      edits={e}
      baseEdits={e}
      box={box}
      getOutMs={() => 0}
      getLayers={() => layers}
      selected={(opts.selected ?? null) as never}
      onSelect={onSelect}
      onCommit={onCommit}
      cropMode={opts.cropMode ?? false}
      onCropModeChange={onCrop}
    />,
    { container: box.appendChild(document.createElement('div')) },
  )
  return { ...utils, box, onSelect, onCommit, onCrop }
}

const textEdits = () =>
  base({ textItems: [{ id: 't1', text: 'Hello', startMs: 0, endMs: 5000, x: 50, y: 25, style: {} }] as ClipEditsV2['textItems'] })

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('G1a canvas selection', () => {
  it('click picks the top-most layer; empty area of the frame = the video', () => {
    const s = stage(textEdits())
    fireEvent.pointerDown(s.box, { clientX: 100, clientY: 100, button: 0 })
    expect(s.onSelect).toHaveBeenLastCalledWith('text:t1')
    fireEvent.pointerDown(s.box, { clientX: 20, clientY: 350, button: 0 })
    expect(s.onSelect).toHaveBeenLastCalledWith('video')
  })

  it('dragging the body moves the layer (x / y %) with snapping, first step pushes history', () => {
    const s = stage(textEdits(), { selected: 'text:t1' })
    fireEvent.pointerDown(s.box, { clientX: 100, clientY: 100, button: 0 })
    fireEvent.pointerMove(window, { clientX: 140, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 150, clientY: 140 })
    fireEvent.pointerUp(window)
    expect(s.onCommit).toHaveBeenCalledTimes(2)
    expect(s.onCommit.mock.calls[0]![1]).toBe(true)
    expect(s.onCommit.mock.calls[1]![1]).toBe(false)
    const last = s.onCommit.mock.calls[1]![0] as ClipEditsV2
    expect(findTrack(last, 'text:t1', 'x')?.value).toBe(25)
    expect(findTrack(last, 'text:t1', 'y')?.value).toBe(10)
  })

  it('Alt-drag near the centre does not snap; plain drag snaps to the centre line', () => {
    const s = stage(textEdits(), { selected: 'text:t1' })
    fireEvent.pointerDown(s.box, { clientX: 100, clientY: 100, button: 0 })
    fireEvent.pointerMove(window, { clientX: 103, clientY: 100 })
    const snapped = s.onCommit.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(snapped, 'text:t1', 'x')?.value ?? 0).toBe(0)
    fireEvent.pointerMove(window, { clientX: 103, clientY: 100, altKey: true })
    const free = s.onCommit.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(free, 'text:t1', 'x')?.value).toBe(1.5)
    fireEvent.pointerUp(window)
  })

  it('corner handle scales, rotate handle rotates', async () => {
    const s = stage(textEdits(), { selected: 'text:t1' })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    const corners = s.getAllByTestId('canvas-handle-scale')
    expect(corners).toHaveLength(4)
    fireEvent.pointerDown(corners[2]!, { clientX: 150, clientY: 120, button: 0 })
    fireEvent.pointerMove(window, { clientX: 200, clientY: 140 })
    fireEvent.pointerUp(window)
    expect(findTrack(s.onCommit.mock.calls.at(-1)![0], 'text:t1', 'scale')?.value).toBe(200)
    fireEvent.pointerDown(s.getByTestId('canvas-handle-rotate'), { clientX: 100, clientY: 50, button: 0 })
    fireEvent.pointerMove(window, { clientX: 150, clientY: 100 })
    fireEvent.pointerUp(window)
    expect(findTrack(s.onCommit.mock.calls.at(-1)![0], 'text:t1', 'rotation')?.value).toBe(90)
  })

  it('double-click edits text in place (Ctrl+Enter saves, one undo step)', () => {
    const s = stage(textEdits())
    fireEvent.doubleClick(s.box, { clientX: 100, clientY: 100 })
    const ta = s.getByTestId('canvas-text-editor') as HTMLTextAreaElement
    expect(ta.value).toBe('Hello')
    fireEvent.change(ta, { target: { value: 'Hello world' } })
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true })
    const [next, push] = s.onCommit.mock.calls.at(-1)!
    expect(push).toBe(true)
    expect((next as ClipEditsV2).textItems![0]!.text).toBe('Hello world')
    expect(s.queryByTestId('canvas-text-editor')).toBeNull()
  })

  it('N9: Escape cancels an inline edit without saving or creating an undo entry', () => {
    const s = stage(textEdits())
    fireEvent.doubleClick(s.box, { clientX: 100, clientY: 100 })
    const ta = s.getByTestId('canvas-text-editor') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'Cancelled change' } })
    fireEvent.keyDown(ta, { key: 'Escape' })
    fireEvent.blur(ta)
    expect(s.queryByTestId('canvas-text-editor')).toBeNull()
    expect(s.onCommit).not.toHaveBeenCalled()
  })

  it('N1: double-click opens inline editor on a transparent libass text hit shell', () => {
    const s = stage(textEdits())
    const shell = s.box.querySelector<HTMLElement>('[style*="transform-origin: 50% 25%"]')!
    shell.style.visibility = 'visible'
    shell.style.opacity = '0'
    fireEvent.doubleClick(s.box, { clientX: 100, clientY: 100 })
    const textarea = s.getByTestId('canvas-text-editor') as HTMLTextAreaElement
    expect(textarea.value).toBe('Hello')
    expect(s.onSelect).toHaveBeenLastCalledWith('text:t1')
  })

  it('crop mode: edge bars write cropL…cropB on the video', async () => {
    const s = stage(base(), { selected: 'video', cropMode: true })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    fireEvent.pointerDown(s.getByTestId('canvas-handle-crop-l'), { clientX: 0, clientY: 200, button: 0 })
    fireEvent.pointerMove(window, { clientX: 50, clientY: 200 })
    fireEvent.pointerUp(window)
    expect(findTrack(s.onCommit.mock.calls.at(-1)![0], 'video', 'cropL')?.value).toBe(25)
  })

  it('locked lane: selects but never edits', () => {
    const e = { ...textEdits(), timelineLanes: { text: { locked: true } } } as ClipEditsV2
    const s = stage(e, { selected: 'text:t1' })
    fireEvent.pointerDown(s.box, { clientX: 100, clientY: 100, button: 0 })
    fireEvent.pointerMove(window, { clientX: 150, clientY: 100 })
    fireEvent.pointerUp(window)
    expect(s.onSelect).toHaveBeenCalledWith('text:t1')
    expect(s.onCommit).not.toHaveBeenCalled()
  })
})

describe('G1a Properties inspector', () => {
  const brollEdits = () =>
    base({
      broll: [
        { id: 'a', source: 'stock', assetId: 'x', startMs: 0, endMs: 4000 },
        { id: 'b', source: 'stock', assetId: 'y', startMs: 1000, endMs: 3000 },
      ],
    })
  function panel(e: ClipEditsV2, target: Parameters<typeof PropertiesPanel>[0]['target']) {
    const onCommit = vi.fn()
    const onCrop = vi.fn()
    const u = render(
      <PropertiesPanel edits={e} target={target} label="Item" outputMs={1500} onCommit={onCommit} onSeekOutput={() => {}} cropMode={false} onCropModeChange={onCrop} />,
    )
    return { ...u, onCommit, onCrop }
  }

  it('tabs follow the selection kind', () => {
    expect(tabsFor('video')).toEqual({ video: null, audio: null, speed: null, animation: null, color: null })
    expect(tabsFor('text:x').audio).toBeTruthy()
    expect(tabsFor('music').video).toBeTruthy()
  })

  it('Video tab: transform ◇ rows (mirrored KeyframeInspector), crop rows, flip, layer order', () => {
    const p = panel(brollEdits(), 'broll:a')
    const tf = p.getByTestId('properties-transform')
    expect(tf.querySelector('[data-testid="kf-toggle-x"]')).toBeTruthy()
    expect(p.getByTestId('properties-crop').querySelector('[data-testid="kf-row-cropL"]')).toBeTruthy()
    fireEvent.click(p.getByTestId('properties-flip-h'))
    expect(layerFlip(p.onCommit.mock.calls.at(-1)![0], 'broll:a').h).toBe(true)
    fireEvent.click(p.getByTestId('properties-order-front'))
    expect(layerZ(p.onCommit.mock.calls.at(-1)![0], 'broll:a')).toBe(1)
    expect((p.getByTestId('properties-order-back') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(p.getByTestId('properties-crop-mode'))
    expect(p.onCrop).toHaveBeenCalledWith(true)
    // ◇ inside Properties writes the same keyframe data as the timeline inspector
    fireEvent.click(tf.querySelector('[data-testid="kf-toggle-scale"]')!)
    expect(findTrack(p.onCommit.mock.calls.at(-1)![0], 'broll:a', 'scale')?.points).toEqual([{ tMs: 1500, v: 100 }])
  })

  it('Animation tab lists keyframes and keys every prop at the playhead', () => {
    const p = panel(base(), 'video')
    fireEvent.click(p.getByTestId('properties-tab-animation'))
    fireEvent.click(p.getByTestId('properties-key-all'))
    const next = p.onCommit.mock.calls.at(-1)![0] as ClipEditsV2
    expect(findTrack(next, 'video', 'x')?.points).toHaveLength(1)
    expect(findTrack(next, 'video', 'cropL')?.points).toHaveLength(1)
  })

  it('Audio tab: voice volume ◇ for the video', () => {
    const p = panel(base(), 'video')
    fireEvent.click(p.getByTestId('properties-tab-audio'))
    expect(p.getByTestId('keyframe-inspector').getAttribute('data-target')).toBe('voice')
  })
})

describe('G1a timeline selectRequest', () => {
  it('a canvas pick selects the item on the timeline (and reports it back)', () => {
    const e = base({ broll: [{ id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 }] })
    const onSel = vi.fn()
    const props = {
      edits: e,
      words: [],
      shots: [],
      outputMs: 6000,
      clipOutputDurationMs: 20000,
      onSeekOutput: () => {},
      clipStartMs: 0,
      clipEndMs: 20000,
      onCommitEdits: () => {},
      onSelectionChange: onSel,
    }
    const u = render(<Timeline {...props} selectRequest={{ lane: 'broll', id: 'b1', seq: 1 }} />)
    expect(onSel).toHaveBeenLastCalledWith(expect.objectContaining({ lane: 'broll', id: 'b1' }))
    u.rerender(<Timeline {...props} selectRequest={{ lane: 'broll', id: '__none__', seq: 2 }} />)
    expect(onSel).toHaveBeenLastCalledWith(null)
  })
})

describe('G1a PreviewStage wiring', () => {
  it('mounts the canvas overlay and draws overlapping layers in stacking order', async () => {
    const { PreviewStage } = await import('@/components/clips/editor/preview-stage')
    const e = base({
      broll: [
        { id: 'b1', source: 'stock', assetId: 'a1', startMs: 1000, endMs: 5000 },
        { id: 'b2', source: 'stock', assetId: 'a2', startMs: 2000, endMs: 4000 },
      ],
      textItems: [
        { id: 't1', text: 'One', startMs: 0, endMs: 3000, x: 50, y: 50, style: {} },
        { id: 't2', text: 'Two', startMs: 0, endMs: 3000, x: 50, y: 50, style: {} },
      ] as ClipEditsV2['textItems'],
      layerProps: [
        { target: 'broll:b1', z: 1 },
        { target: 'text:t1', z: 1 },
      ],
    })
    const r = render(
      <PreviewStage
        videoUrl="https://example.com/video.mp4"
        edits={e}
        words={[{ i: 0, w: 'hi', s: 0.5, e: 1 }]}
        cropTrack={null}
        brollMedia={[
          { id: 'b1', source: 'stock', startMs: 1000, endMs: 5000, url: 'https://example.com/b1.mp4' },
          { id: 'b2', source: 'stock', startMs: 2000, endMs: 4000, url: 'https://example.com/b2.mp4' },
        ]}
        videoRef={{ current: null }}
        onTick={vi.fn()}
        testBoxSize={{ w: 180, h: 320 }}
        canvas={{ baseEdits: e, selected: null, onSelect: vi.fn(), onCommit: vi.fn(), cropMode: false, onCropModeChange: vi.fn() }}
      />,
    )
    expect(r.getByTestId('canvas-selection-overlay')).toBeTruthy()
    expect(r.getAllByTestId('preview-broll-layer').map((el) => el.getAttribute('data-broll-id'))).toEqual(['b2', 'b1'])
    expect(r.getAllByTestId('preview-text-item').map((el) => el.getAttribute('data-text-id'))).toEqual(['t2', 't1'])
  })
})

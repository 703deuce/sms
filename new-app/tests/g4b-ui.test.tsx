// @vitest-environment happy-dom
/**
 * G4b web: title templates on a free text track, speed curves, layer-fx controls / preview helpers /
 * persistence, chroma-key notice without WebGL, transitions popover groups, effects presets.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { defaultEdits, editsPayloadForSave, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { newTextItem } from '@/lib/clips/editor/text-items'
import { effectiveTracks, placeOnFreeTrack, trackIdOf } from '@/lib/clips/editor/tracks'
import { applySpeedCurve, curvePieces, curveSpeedAt, matchSpeedCurve } from '@/lib/clips/editor/speed-curves'
import { speedAtSource } from '@/lib/clips/editor/speed'
import { layerFxOf, setLayerFx } from '@/lib/clips/editor/layer-fx'
import { LayerFxControls, setMaskGeom, toggleMaskKey } from '@/components/clips/editor/g4/layer-fx-controls'
import { applyLayerFx, exportFrameFor, reversedMediaTime } from '@/components/clips/editor/g4/layer-fx-preview'
import { GradePreview } from '@/components/clips/editor/g4/grade-preview'
import { TransitionPopover } from '@/components/clips/editor/timeline/transition-popover'
import { FxControls } from '@/components/clips/editor/g4/grade-controls'
import { TRANSITIONS, transitionFrame, compositeCss } from '@/lib/clips/editor/transitions'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = () => normalizeEdits(defaultEdits(bounds), bounds)

describe('title templates land on a free text track', () => {
  it('moves new items off a busy track and reuses a free one', () => {
    const e0 = { ...base(), textItems: [newTextItem('old', 0, 20000)] } as ClipEditsV2
    const old = e0.textItems![0]!
    const add = { ...newTextItem('new', old.startMs + 100, 20000) }
    const e1 = { ...e0, textItems: [...e0.textItems!, add] }
    const placed = placeOnFreeTrack(e1, 'text', ['new'], add.startMs, add.endMs)
    expect(trackIdOf(placed, 'text', 'new')).not.toBe(trackIdOf(placed, 'text', 'old'))
    expect(effectiveTracks(placed).filter((t) => t.kind === 'text').length).toBe(2)
    // Far from any other text: stays where it is (no new track).
    const far = { ...newTextItem('far', 15000, 20000) }
    const e2 = { ...e0, textItems: [{ ...old, endMs: 1000 }, far] }
    const p2 = placeOnFreeTrack(e2, 'text', ['far'], far.startMs, far.endMs)
    expect(p2).toBe(e2)
  })
})

describe('speed curves', () => {
  it('compiles presets into stepped source-anchored pieces', () => {
    const p = curvePieces('montage', 1000, 5000)
    expect(p).toHaveLength(8)
    expect(p[0]!.fromMs).toBe(1000)
    expect(p[7]!.toMs).toBe(5000)
    expect(p[0]!.speed).toBeGreaterThan(1)
    expect(p[3]!.speed).toBe(0.5)
    expect(curveSpeedAt('ramp_up', 0)).toBeCloseTo(0.5)
    expect(curveSpeedAt('ramp_up', 1)).toBeCloseTo(3)
    expect(curvePieces('hero', 0, 300)).toHaveLength(2)
    const outside = [{ fromMs: 8000, toMs: 9000, speed: 2 }]
    const s = applySpeedCurve(outside, 1000, 5000, 'bullet')
    expect(speedAtSource(s, 8500)).toBe(2)
    expect(matchSpeedCurve(s, 1000, 5000)).toBe('bullet')
    expect(matchSpeedCurve(outside, 1000, 5000)).toBeNull()
  })
})

describe('layer fx', () => {
  it('mask keys edit the key at the playhead (100 ms steps)', () => {
    const m0 = { shape: 'rect' as const, x: 50, y: 50, w: 60, h: 40, rot: 0, feather: 10 }
    expect(setMaskGeom(m0, 'x', 30, 1234).x).toBe(30)
    const k1 = toggleMaskKey(m0, 250)
    expect(k1.keys).toEqual([{ ms: 200, x: 50, y: 50, w: 60, h: 40, rot: 0, feather: 10 }])
    const k2 = setMaskGeom(k1, 'x', 80, 1050)
    expect(k2.keys!.map((k) => [k.ms, k.x])).toEqual([[200, 50], [1000, 80]])
    const k3 = toggleMaskKey(toggleMaskKey(k2, 1000), 200)
    expect(k3.keys).toBeUndefined()
  })

  it('persists through normalize + save payload, cleared → null', () => {
    const e = { ...base(), layerFx: setLayerFx(undefined, 'b1', { blend: 'screen', reverse: true }) } as ClipEditsV2
    const n = normalizeEdits(JSON.parse(JSON.stringify(e)), bounds)
    expect(layerFxOf(n, 'b1')).toEqual({ target: 'broll:b1', blend: 'screen', reverse: true })
    expect(editsPayloadForSave({ ...n, layerFx: undefined }).layerFx).toBeNull()
    expect(setLayerFx(n.layerFx, 'b1', null)).toBeUndefined()
  })

  it('controls write layerFx rows', () => {
    const W = () => {
      const [e, set] = useState<ClipEditsV2>({ ...base(), broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 0, endMs: 3000 }] } as ClipEditsV2)
      return (
        <>
          <LayerFxControls edits={e} itemId="b1" localMs={500} isVideo onCommit={set} readOnly={false} />
          <pre data-testid="dump">{JSON.stringify(e.layerFx ?? null)}</pre>
        </>
      )
    }
    const r = render(<W />)
    fireEvent.click(r.getByTestId('layer-fx-mask-ellipse'))
    fireEvent.click(r.getByTestId('layer-fx-key-toggle'))
    fireEvent.click(r.getByTestId('layer-fx-blend-multiply'))
    fireEvent.click(r.getByTestId('layer-fx-reverse-toggle'))
    fireEvent.click(r.getByTestId('layer-fx-mask-key'))
    const row = JSON.parse(r.getByTestId('dump').textContent!)[0]
    expect(row.mask.shape).toBe('ellipse')
    expect(row.mask.keys[0].ms).toBe(500)
    expect(row.key.color).toBe('#00ff00')
    expect(row.blend).toBe('multiply')
    expect(row.reverse).toBe(true)
    fireEvent.click(r.getByTestId('layer-fx-blend-normal'))
    fireEvent.click(r.getByTestId('layer-fx-mask-none'))
    fireEvent.click(r.getByTestId('layer-fx-key-toggle'))
    fireEvent.click(r.getByTestId('layer-fx-reverse-toggle'))
    expect(r.getByTestId('dump').textContent).toBe('null')
  })

  it('preview: mask image + blend mode set and cleared; reverse time mapping', () => {
    const fx = document.createElement('div')
    const region = document.createElement('div')
    const row = { target: 'broll:b1', mask: { shape: 'rect' as const, x: 50, y: 50, w: 50, h: 50, rot: 0, feather: 0 }, blend: 'screen' as const }
    const { W, H } = exportFrameFor(360, 640)
    expect([W, H]).toEqual([1080, 1920])
    applyLayerFx(fx, region, row, 0, W, H)
    expect(region.style.mixBlendMode).toBe('screen')
    expect(fx.dataset.g4bMask === '1' || fx.style.maskImage === '').toBe(true)
    applyLayerFx(fx, region, undefined, 0, W, H)
    expect(region.style.mixBlendMode).toBe('')
    expect(fx.dataset.g4bMask).toBeUndefined()
    // export: output frame k of a reversed item = in + own − (k + 1)/30
    expect(reversedMediaTime(1000, 3000, 0)).toBeCloseTo((4000 - 1000 / 30) / 1000, 6)
    expect(reversedMediaTime(1000, 3000, 2990)).toBeCloseTo(1, 6)
    expect(reversedMediaTime(1000, 3000, 9999)).toBe(1)
  })

  it('chroma key without WebGL: notice, playback untouched', () => {
    const gp = new GradePreview()
    const layer = document.createElement('div')
    const v = document.createElement('video')
    layer.appendChild(v)
    gp.begin(0)
    gp.apply(layer, undefined, [v], { rgb: [0, 255, 0], similarity: 0.2, blend: 0.03, despill: null })
    expect(gp.end()).toMatch(/^Chroma key preview off/)
    expect(v.getAttribute('data-g4-src')).toBeNull()
  })
})

describe('transitions + effects UI', () => {
  it('popover lists the new groups; mask transitions produce a mask key', () => {
    const r = render(<TransitionPopover title="Cut" value={null} anchor={{ x: 0, y: 0 }} onApply={vi.fn()} onClose={vi.fn()} />)
    for (const g of ['Soft wipe', 'Shape', 'Slice']) expect(r.getByText(g)).toBeTruthy()
    const shape = TRANSITIONS.find((t) => t.type === 'circle_open')!
    const f = transitionFrame(shape.type, 0.4)
    const css = compositeCss(f, true, 360)
    expect(css.a.mask).toMatch(/^circleopen\|/)
  })

  it('effects presets set several effects at once', () => {
    const onCommit = vi.fn()
    const r = render(<FxControls spec={{}} onLive={vi.fn()} onCommit={onCommit} />)
    fireEvent.click(r.getByTestId('color-fx-preset-film'))
    expect(onCommit.mock.calls[0]![0].fx).toMatchObject({ grain: 35, vignette: 35, flicker: 20 })
  })
})

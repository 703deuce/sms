// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { ColorPanel } from '@/components/clips/editor/color-panel'
import { GradeFilterBank } from '@/components/clips/editor/g4/grade-filters'
import { lookKey, type ColorSpec } from '@/lib/clips/editor/color'
import { grainOffset } from '@/lib/clips/editor/color-grade'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch })
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]![0] as ClipEditsV2
const click = (el: Element) => act(() => void fireEvent.click(el))

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).startsWith('/api/clips/luts'))
        return new Response(JSON.stringify({ data: { luts: [{ id: 'lut_1', name: 'Teal', filename: 't.cube', size: 33, bytes: 10 }] } }), { status: 200 })
      return new Response('{}', { status: 404 })
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('G4a Color panel', () => {
  it('all Adjust sliders, sections, keyframes and Add adjustment layer (credits-only: no $)', () => {
    const onEdits = vi.fn()
    const onTarget = vi.fn()
    const t = render(
      <ColorPanel edits={base()} target={{ kind: 'video' }} onEdits={onEdits} outputMs={4000} outputDurationMs={20000} onSeekOutput={() => {}} onTargetChange={onTarget} />,
    )
    for (const k of ['exposure', 'brightness', 'contrast', 'saturation', 'temperature', 'tint', 'highlights', 'shadows', 'vibrance'])
      expect(t.getByTestId(`color-adjust-${k}`)).toBeTruthy()
    for (const s of ['curves', 'wheels', 'hsl', 'lut', 'fx', 'scopes']) expect(t.getByTestId(`color-section-${s}`)).toBeTruthy()
    expect(t.getByTestId('keyframe-inspector').getAttribute('data-target')).toBe('video')
    expect(t.getByTestId('kf-row-cExposure')).toBeTruthy()
    click(t.getByTestId('color-add-adjust-layer'))
    const e = last(onEdits)
    expect(e.adjustLayers).toHaveLength(1)
    expect(e.adjustLayers![0]).toMatchObject({ startMs: 4000, endMs: 7000 })
    expect(onTarget).toHaveBeenCalledWith({ kind: 'adjust', id: e.adjustLayers![0]!.id, label: 'Adjustment' })
    expect(t.container.textContent).not.toContain('$')
  })

  it('a color keyframe toggled at the playhead lands on the target track (output ms)', () => {
    const onEdits = vi.fn()
    const t = render(<ColorPanel edits={base()} target={{ kind: 'video' }} onEdits={onEdits} outputMs={1200} outputDurationMs={20000} onSeekOutput={() => {}} />)
    click(t.getByTestId('kf-toggle-cContrast'))
    expect(last(onEdits).keyframes).toEqual([{ target: 'video', prop: 'cContrast', points: [{ tMs: 1200, v: 0 }] }])
  })

  it('adjustment layer target: no HSL / LUT, local keyframes, delete', () => {
    const e = base({ adjustLayers: [{ id: 'a1', startMs: 1000, endMs: 3000, spec: { adjust: { contrast: 20 } } }] })
    const onEdits = vi.fn()
    const onTarget = vi.fn()
    const t = render(
      <ColorPanel edits={e} target={{ kind: 'adjust', id: 'a1', label: 'Adj 1' }} onEdits={onEdits} outputMs={1500} outputDurationMs={20000} onSeekOutput={() => {}} onTargetChange={onTarget} />,
    )
    expect(t.getByTestId('color-target').textContent).toBe('Adjustment · Adj 1')
    expect(t.queryByTestId('color-section-hsl')).toBeNull()
    expect(t.queryByTestId('color-section-lut')).toBeNull()
    expect(t.queryByTestId('color-apply-all')).toBeNull()
    expect(t.getByTestId('keyframe-inspector').getAttribute('data-target')).toBe('adjust:a1')
    click(t.getByTestId('kf-toggle-cExposure'))
    expect(last(onEdits).keyframes![0]).toMatchObject({ target: 'adjust:a1', points: [{ tMs: 500, v: 0 }] })
    click(t.getByTestId('color-filter-vivid'))
    expect(last(onEdits).adjustLayers![0]!.spec.preset).toBe('vivid')
    click(t.getByTestId('color-reset'))
    expect(last(onEdits).adjustLayers![0]!.spec).toEqual({})
    click(t.getByTestId('color-adjust-layer-delete'))
    expect(last(onEdits).adjustLayers).toBeUndefined()
    expect(onTarget).toHaveBeenLastCalledWith({ kind: 'video' })
  })

  it('HSL tabs, wheel reset, curve reset and LUT pick write ColorSpec fields', async () => {
    const e = base({ color: { video: { curves: { m: [[0, 0.1], [1, 0.9]] }, wheels: { lift: { x: 0.3, y: 0, l: 0 } } } as ColorSpec } })
    const onEdits = vi.fn()
    const t = render(<ColorPanel edits={e} target={{ kind: 'video' }} onEdits={onEdits} />)
    click(t.getByTestId('color-section-toggle-hsl'))
    click(t.getByTestId('color-hsl-tab-blue'))
    expect(t.getByTestId('color-hsl-h-row').textContent).toContain('Blue')
    click(t.getByTestId('color-section-toggle-wheels'))
    act(() => void fireEvent.doubleClick(t.getByTestId('color-wheel-pad-lift')))
    expect(last(onEdits).color?.video?.wheels).toBeUndefined()
    click(t.getByTestId('color-section-toggle-curves'))
    expect(t.getAllByTestId(/color-curve-pt-/)).toHaveLength(2)
    click(t.getByTestId('color-curve-reset'))
    expect(last(onEdits).color?.video?.curves).toBeUndefined()
    click(t.getByTestId('color-section-toggle-lut'))
    await waitFor(() => expect(t.getByTestId('color-lut-item-lut_1')).toBeTruthy())
    click(t.getByTestId('color-lut-item-lut_1'))
    expect(last(onEdits).color?.video?.lut).toEqual({ id: 'lut_1' })
  })

  it('B-roll target: scopes shown, Auto / eyedropper off', () => {
    const e = base({ broll: [{ id: 'b1', source: 'stock', assetId: 'x', startMs: 0, endMs: 2000 }] })
    const t = render(<ColorPanel edits={e} target={{ kind: 'broll', id: 'b1', label: 'B' }} onEdits={vi.fn()} />)
    click(t.getByTestId('color-section-toggle-scopes'))
    expect((t.getByTestId('color-auto') as HTMLButtonElement).disabled).toBe(true)
    expect((t.getByTestId('color-wb-pick') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('G4a preview filters (SVG chain)', () => {
  it('builds exposure table → matrix → post tables → sharpen → vignette → grain; spatial-only variant; legacy ids kept', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const bank = new GradeFilterBank()
    bank.attach(host)
    const spec: ColorSpec = { adjust: { exposure: 20, contrast: 10 }, curves: { r: [[0, 0], [0.5, 0.6], [1, 1]] }, fx: { sharpen: 40, vignette: 30, grain: 20 } }
    const css = bank.css(spec)
    expect(css).toBe(`url(#g4-${lookKey(spec)})`)
    const f = host.querySelector(`#g4-${lookKey(spec)}`)!
    const tags = Array.from(f.children).map((c) => c.tagName.toLowerCase())
    expect(tags).toEqual(['fecomponenttransfer', 'fecolormatrix', 'fecomponenttransfer', 'feconvolvematrix', 'feimage', 'fecomposite', 'feimage', 'fecomposite'])
    expect(f.getAttribute('color-interpolation-filters')).toBe('sRGB')
    const sp = bank.css(spec, { spatialOnly: true })
    const fs = host.querySelector(`#g4-${lookKey(spec)}-sp`)!
    expect(sp).toContain('-sp')
    expect(Array.from(fs.children).map((c) => c.tagName.toLowerCase())).toEqual(['feconvolvematrix', 'feimage', 'fecomposite', 'feimage', 'fecomposite'])
    bank.setFrame(3)
    const grainImg = f.querySelectorAll('feImage')[1]!
    const [ox] = grainOffset(3)
    expect(Number(grainImg.getAttribute('x'))).toBeCloseTo(-ox / Math.ceil(720 / 2), 6) // default play 720×1280 → cell 2
    const legacy: ColorSpec = { preset: 'warm' }
    bank.staticKeys = new Set([lookKey(legacy)])
    expect(bank.css(legacy)).toBe(`url(#e4look-${lookKey(legacy)})`)
    expect(bank.css({})).toBe('')
    expect(bank.css({ adjust: { contrast: 10 } }, { spatialOnly: true })).toBe('')
  })
})

// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits, displayDurationMs, displayPositionMs, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import { newTextItem } from '@/lib/clips/editor/text-items'
import { coalescePush } from '@/lib/clips/editor/undo-coalesce'
import { setSegmentLook, setVideoLook } from '@/lib/clips/editor/color'
import { exportLayoutHint, layoutMiniPreviewLabel } from '@/lib/clips/layout-options'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { ColorPanel, resetScope } from '@/components/clips/editor/color-panel'
import { templateCaptionBottomPct } from '@/components/clips/editor/caption-overlay'
import { ExportLayoutPicker } from '@/components/clips/editor/export-layout-picker'
import { ExportHeadlinePreview } from '@/components/clips/editor/export-headline-preview'

const here = path.dirname(fileURLToPath(import.meta.url))
const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}
afterEach(() => cleanup())

describe('E4fix fonts', () => {
  it('every caption/text font var is defined by the editor font loaders', () => {
    const src =
      readFileSync(path.resolve(here, '../components/clips/editor/clip-editor-fonts.ts'), 'utf8') +
      readFileSync(path.resolve(here, '../components/clips/editor/editor-shell.tsx'), 'utf8')
    const fonts = ['Anton', 'Montserrat', 'Poppins', 'Bangers', 'Inter', 'Lato', 'Bebas Neue', 'Archivo Black', 'Oswald', 'Luckiest Guy']
    for (const f of fonts) {
      const v = /var\((--[a-z-]+)\)/.exec(captionFontStack(f))?.[1]
      expect(v, f).toBeTruthy()
      expect(src.includes(`variable: '${v}'`), `${f} → ${v}`).toBe(true)
    }
  })
})

describe('E4fix undo coalescing', () => {
  it('coalescePush: one step per burst on one control', () => {
    expect(coalescePush(null, 'a', 0, 's')).toBe(true)
    expect(coalescePush({ key: 'a', at: 0, sig: 's' }, 'a', 300, 's')).toBe(false)
    expect(coalescePush({ key: 'a', at: 0, sig: 's' }, 'b', 300, 's')).toBe(true)
    expect(coalescePush({ key: 'a', at: 0, sig: 's' }, 'a', 600, 's')).toBe(true)
    expect(coalescePush({ key: 'a', at: 0, sig: 's' }, 'a', 300, 'other')).toBe(true) // after undo
  })

  it('TextPanel: a burst of colour changes = one history push, a different control pushes again', () => {
    const it0 = newTextItem('t1', 0, 20000, 'basic', 'Hi')
    let e = base({ textItems: [it0] })
    const onEdits = vi.fn((n: ClipEditsV2, _push?: boolean) => {
      e = n
    })
    const t = render(<TextPanel edits={e} onEdits={onEdits} playheadMs={0} durationMs={20000} selectedId="t1" onSelect={vi.fn()} />)
    const input = t.container.querySelector('input[type="color"]') as HTMLInputElement
    act(() => void fireEvent.change(input, { target: { value: '#ff0000' } }))
    t.rerender(<TextPanel edits={e} onEdits={onEdits} playheadMs={0} durationMs={20000} selectedId="t1" onSelect={vi.fn()} />)
    act(() => void fireEvent.change(input, { target: { value: '#ff1100' } }))
    t.rerender(<TextPanel edits={e} onEdits={onEdits} playheadMs={0} durationMs={20000} selectedId="t1" onSelect={vi.fn()} />)
    expect(onEdits.mock.calls.map((c) => c[1] ?? true)).toEqual([true, false])
    act(() => void fireEvent.click(t.getByTestId('text-align-left')))
    expect(onEdits.mock.calls[2]?.[1] ?? true).toBe(true)
  })
})

describe('E4fix colour reset scope', () => {
  const warmSeg = (e: ClipEditsV2) => ({ ...e, color: setSegmentLook(setVideoLook(e.color, { preset: 'cool' }), 0, 5000, { preset: 'warm' }) })

  it('Whole-video Reset keeps per-clip looks; clip Reset drops only that override', () => {
    const e = warmSeg(base())
    const v = resetScope(e, { kind: 'video' })
    expect(v.color?.video).toBeFalsy()
    expect(v.color?.segments?.[0]?.spec?.preset ?? (v.color?.segments?.[0] as { preset?: string })?.preset).toBe('warm')
    const s = resetScope(e, { kind: 'segment', fromMs: 0, toMs: 5000, label: 'A' })
    expect(s.color?.segments?.length ?? 0).toBe(0)
    expect(s.color?.video).toBeTruthy()
  })

  it('panel: Reset all only appears when other looks exist and clears everything', () => {
    const onEdits = vi.fn()
    const plain = render(<ColorPanel edits={base()} target={{ kind: 'video' }} onEdits={onEdits} />)
    expect(plain.queryByTestId('color-reset-all')).toBeNull()
    cleanup()
    const t = render(<ColorPanel edits={warmSeg(base())} target={{ kind: 'video' }} onEdits={onEdits} />)
    act(() => void fireEvent.click(t.getByTestId('color-reset')))
    expect((onEdits.mock.calls[0]![0] as ClipEditsV2).color?.segments?.length).toBe(1)
    act(() => void fireEvent.click(t.getByTestId('color-reset-all')))
    expect((onEdits.mock.calls[1]![0] as ClipEditsV2).color).toBeUndefined()
  })
})

describe('E4fix caption Y in template mode', () => {
  it('bottom margin = playH − (rect.y + rect.h), the worker MarginV', () => {
    // default T6 rect: y = 0.65·H, h = 0.12·H → captions sit on 77 % (was the preset ~15 % bottom margin).
    expect(templateCaptionBottomPct({ y: 832, h: 154, playH: 1280 })).toBeCloseTo(((1280 - 986) / 1280) * 100, 6)
  })
})

describe('E4fix output time with per-item speed', () => {
  it('clock position and length use the warped output timeline', () => {
    const e = base({ segmentSpeeds: [{ fromMs: 0, toMs: 10000, speed: 2 }] } as Partial<ClipEditsV2>)
    expect(displayDurationMs(e)).toBe(15000)
    expect(displayPositionMs(e, 10000)).toBe(5000)
    expect(displayPositionMs(e, 20000)).toBe(15000)
    expect(displayPositionMs({ ...e, speed: 1.5 }, 20000)).toBe(10000)
  })
})

describe('E4fix export dialog reflects the saved layout', () => {
  it('helper line and mini preview label follow the selected layout', () => {
    const t = render(<ExportLayoutPicker value="facecam_stack" onChange={vi.fn()} edits={base()} />)
    expect(t.getByTestId('export-layout-hint').textContent).toMatch(/Facecam stack/)
    expect(t.getByTestId('export-layout-hint').textContent).not.toMatch(/Full frame keeps/)
    expect(exportLayoutHint('full_frame')).toMatch(/Full frame/)
    expect(layoutMiniPreviewLabel('facecam_stack')).toBe('Facecam over gameplay')
    expect(layoutMiniPreviewLabel('fit_top')).toBe('16:9 + blur fill')
    cleanup()
    const p = render(<ExportHeadlinePreview headline="Hi" showBadge={false} videoLabel={layoutMiniPreviewLabel('facecam_stack')} />)
    expect(p.getByTestId('export-mini-video-label').textContent).toBe('Facecam over gameplay')
  })
})

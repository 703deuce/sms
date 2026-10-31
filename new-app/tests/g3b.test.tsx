// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  flagsToMarks,
  marksToFlags,
  newProgressItem,
  newShapeItem,
  newStickerItem,
  newTemplateItems,
  newTextItem,
  normalizeTextItems,
  parseInlineMarks,
  remapMarks,
  textItemLabel,
  TEXT_MAX_ITEMS,
  TITLE_TEMPLATES,
  toggleMark,
  type TextItem,
} from '@/lib/clips/editor/text-items'
import { normalizeBrollItems, type BrollItem } from '@/lib/clips/broll'
import { layerAnimAt, splitAnim } from '@/lib/clips/editor/layer-anim'
import { brollFrame } from '@/lib/clips/editor/motion-frame'
import { splitAt, type OpCtx } from '@/lib/clips/editor/clip-timeline'
import { buildTextItemsAss } from '@/lib/clips/render-plan/text-items-ass'
import { fontUrlsForAss } from '@/lib/clips/render-plan/preview-scripts'
import { parseFont, FontParseError } from '@/lib/clips/font-parse'
import { isReservedFamily } from '@/lib/clips/fonts-shared'
import { assEmPerFontsize } from '@/lib/clips/caption-fit'
import { setWorkspaceFonts, __resetWorkspaceFonts } from '@/lib/clips/editor/workspace-fonts'
import { G3B_TINY_TTF_B64 } from './fixtures/g3b-font'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { PropertiesPanel } from '@/components/clips/editor/properties-panel'
import { TextAnimSection } from '@/components/clips/editor/text-anim-section'

afterEach(() => {
  cleanup()
  __resetWorkspaceFonts()
})

const here = path.dirname(fileURLToPath(import.meta.url))
const WORKER = path.resolve(here, '../../worker')
const base = (): ClipEditsV2 => defaultEdits({ clipStartMs: 0, clipEndMs: 20_000 })
const ctxOf = (edits: ClipEditsV2): OpCtx => ({ edits, previewEdits: edits })
const tinyFont = () => new Uint8Array(Buffer.from(G3B_TINY_TTF_B64, 'base64'))

describe('G3b text model', () => {
  it('rich text: marks canonical, toggled on a selection or the whole text, follow edits', () => {
    const it0 = { ...newTextItem('t1', 0, 10_000, 'basic', 'Hello big world') }
    const bold = toggleMark(it0, 1, 6, 9)
    expect(bold).toEqual([{ s: 6, e: 9, b: true }])
    const both = toggleMark({ ...it0, marks: bold }, 2, 0, 0)
    expect(both).toEqual([{ s: 0, e: 6, i: true }, { s: 6, e: 9, b: true, i: true }, { s: 9, e: 15, i: true }])
    expect(toggleMark({ ...it0, marks: both }, 2, 0, 0)).toEqual([{ s: 6, e: 9, b: true }])
    // typing inside the bold word keeps it bold; text before shifts it
    expect(remapMarks('Hello big world', 'Hello bigger world', bold)).toEqual([{ s: 6, e: 12, b: true }])
    expect(remapMarks('Hello big world', 'Oh hello big world', bold)).toEqual([{ s: 9, e: 12, b: true }])
    expect(flagsToMarks(marksToFlags([{ s: 0, e: 3, b: true }, { s: 3, e: 5, b: true }], 6))).toEqual([{ s: 0, e: 5, b: true }])
    const [n] = normalizeTextItems([{ ...it0, marks: [{ s: 3, e: 1, b: true }, { s: 0, e: 2, b: true }, { s: 2, e: 99, b: true }, { s: 0, e: 4 }] }], 20_000)
    expect(n!.marks).toEqual([{ s: 0, e: 15, b: true }])
    expect(parseInlineMarks('A <i>b</i> <B>c</B>')).toEqual({ text: 'A b c', marks: [{ s: 2, e: 3, i: true }, { s: 4, e: 5, b: true }] })
  })

  it('letter spacing / line height / gradient / user fonts normalize (defaults omitted)', () => {
    const t = newTextItem('t1', 0, 10_000, 'basic', 'Hi')
    const [a] = normalizeTextItems(
      [{ ...t, style: { ...t.style, letterSpacing: 250, lineHeight: 1.234, gradient: { from: '#ff0000', to: '#00ff00', dir: 'x' }, font: 'user:font_abc', fontFamily: 'My, Font{}' } }],
      20_000,
    )
    expect(a!.style).toMatchObject({ letterSpacing: 100, lineHeight: 1.23, gradient: { from: '#FF0000', to: '#00FF00', dir: 'v' }, font: 'user:font_abc', fontFamily: 'My Font' })
    const [b] = normalizeTextItems([{ ...t, style: { ...t.style, letterSpacing: 0, lineHeight: 1, font: 'user:font_abc' } }], 20_000)
    expect(b!.style.letterSpacing).toBeUndefined()
    expect(b!.style.lineHeight).toBeUndefined()
    expect(b!.style.font).toBe('Montserrat') // a user font without its family falls back
    expect(b!.style.fontFamily).toBeUndefined()
  })

  it('shapes / stickers / progress: empty text kept, invalid dropped, whole-layer anim only', () => {
    const sh = newShapeItem('s1', 'star', 0, 20_000)
    const st = { ...newStickerItem('s2', 'heart', 0, 20_000), style: { ...newStickerItem('s2', 'heart', 0, 20_000).style, size: 900 } }
    const pr = newProgressItem('s3', 20_000)
    const bad = { ...newShapeItem('s4', 'star', 0, 20_000), shape: { type: 'nope', w: 1, h: 1 } }
    const tw = { ...sh, id: 's5', anim: { in: { type: 'typewriter', unit: 'char', durMs: 800 } } }
    const out = normalizeTextItems([sh, st, pr, bad, tw], 20_000)
    expect(out.map((x) => x.id)).toEqual(['s1', 's2', 's3', 's5'])
    expect(out[0]).toMatchObject({ kind: 'shape', text: '', shape: { type: 'star', w: 400, h: 400 } })
    expect(out[1]!.style.size).toBe(900)
    expect(out[2]).toMatchObject({ kind: 'progress', startMs: 0, endMs: 20_000, progress: { w: 100, h: 16, track: '#FFFFFF', trackOpacity: 35 } })
    expect(out[3]!.anim).toEqual({ in: { type: 'fade', unit: 'block', durMs: 800 } })
    expect(out.map(textItemLabel)).toEqual(['Shape · Star', 'Sticker · Heart', 'Progress bar', 'Shape · Star'])
    expect(TEXT_MAX_ITEMS).toBe(60)
  })

  it('every animated title template survives normalization and builds ASS', () => {
    let n = 0
    for (const tpl of TITLE_TEMPLATES) {
      const items = newTemplateItems(tpl.id, () => `x${n++}`, 2000, 20_000)
      expect(items.length).toBe(tpl.parts.length)
      const norm = normalizeTextItems(items, 20_000)
      expect(norm).toEqual(items)
      expect(norm.every((i) => i.anim)).toBe(true)
      const ass = buildTextItemsAss({ ...base(), textItems: norm } as unknown as Record<string, unknown>, 1080, 1920)
      expect(ass).toContain('Dialogue:')
    }
    expect(TITLE_TEMPLATES.length).toBeGreaterThanOrEqual(5)
    const lower = newTemplateItems('lower_third', () => `y${n++}`, 0, 20_000)
    expect(lower[1]!.text).toBe('Your Name\nTitle · Company')
    expect(lower[1]!.marks).toEqual([{ s: 10, e: 25, i: true }])
  })

  it('shape library: web JSON is a byte copy of the worker JSON', () => {
    const w = readFileSync(path.join(WORKER, 'clips_worker/text_shapes.json'), 'utf8')
    const t = readFileSync(path.resolve(here, '../lib/clips/render-plan/text-shapes.json'), 'utf8')
    expect(t).toBe(w)
  })
})

describe('G3b layer animation (B-roll / images / overlays)', () => {
  const FIX = JSON.parse(readFileSync(path.join(WORKER, 'tests/fixtures/render_plan/g3b_layer_anim.json'), 'utf8')) as {
    item: BrollItem & { anim: unknown }
    samples: { t: number; op: number; sc: number; dx: number; dy: number; rot: number }[]
  }[]
  it('preview layerAnimAt == worker motion.layer_anim_at', () => {
    for (const c of FIX)
      for (const s of c.samples) {
        const r = layerAnimAt(c.item, s.t)
        for (const k of ['op', 'sc', 'dx', 'dy', 'rot'] as const) expect(r[k]).toBeCloseTo(s[k], 6)
      }
  })
  it('normalizeBrollItems keeps the preset (whole-layer); brollFrame composes it on the keyframes', () => {
    const raw = [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 1000, endMs: 4000, anim: { in: { type: 'typewriter', unit: 'char', durMs: 600 }, out: { type: 'slide_down', unit: 'word', durMs: 500 } } }]
    const items = normalizeBrollItems(raw, 20_000)
    expect(items[0]!.anim).toEqual({ in: { type: 'fade', unit: 'block', durMs: 600 }, out: { type: 'slide_down', unit: 'block', durMs: 500 } })
    const e = { ...base(), broll: items }
    expect(brollFrame(e, 1000, 1080).items.b1!.box!.opacity).toBeCloseTo(0, 6)
    expect(brollFrame(e, 2500, 1080).items.b1!.box!.opacity).toBeCloseTo(1, 6)
    // slide_down out exits downward: positive y translate near the end
    const late = brollFrame(e, 3900, 1080).items.b1!.box!.transform
    expect(late).toMatch(/translate\(0%, [1-9][0-9.]*%\)|translate\(0px, [1-9]/)
  })
  it('split: left half keeps the in, right half keeps the out (B-roll and text)', () => {
    const anim = { in: { type: 'pop' as const, unit: 'block' as const, durMs: 400 }, out: { type: 'fade' as const, unit: 'block' as const, durMs: 400 }, loop: { type: 'pulse' as const, periodMs: 900 } }
    expect(splitAnim({ anim }, 'left').anim).toEqual({ in: anim.in, loop: anim.loop })
    expect(splitAnim({ anim: { out: anim.out } }, 'left').anim).toBeUndefined()
    const b: BrollItem = { id: 'b1', source: 'stock', assetId: 'a', startMs: 1000, endMs: 7000, anim }
    const t: TextItem = { ...newTextItem('t1', 1000, 20_000, 'basic', 'Hi'), endMs: 5000, anim }
    const e = { ...base(), broll: [b], textItems: [t] }
    const nb = splitAt(ctxOf(e), [{ lane: 'broll', id: 'b1' }], 4000)!
    expect(nb.broll!.map((x) => Object.keys(x.anim ?? {}).sort().join())).toEqual(['in,loop', 'loop,out'])
    const nt = splitAt(ctxOf(e), [{ lane: 'text', id: 't1' }], 3000)!
    expect(nt.textItems!.map((x) => Object.keys(x.anim ?? {}).sort().join())).toEqual(['in,loop', 'loop,out'])
  })
})

describe('G3b workspace fonts', () => {
  it('parses family + caption-fit metrics from a TTF', () => {
    const p = parseFont(tinyFont())
    expect(p.family).toBe('G3b Test Sans')
    expect(p.format).toBe('ttf')
    expect(p.metrics.unitsPerEm).toBe(1000)
    expect(p.metrics.assEmPerFontsize).toBeCloseTo(1000 / 1200, 6)
    expect(p.metrics.adv).toMatchObject({ '32': 250, '65': 600, '66': 640, '97': 520, '192': 600 })
    expect(p.metrics.defaultAdv).toBe(Math.round((250 + 600 + 640 + 520) / 4))
  })
  it('rejects non-fonts, WOFF and built-in family names', () => {
    expect(() => parseFont(new Uint8Array(64))).toThrow(FontParseError)
    const woff = new Uint8Array(64)
    woff.set([0x77, 0x4f, 0x46, 0x46])
    expect(() => parseFont(woff)).toThrow(/WOFF/)
    expect(isReservedFamily('anton')).toBe(true)
    expect(isReservedFamily('G3b Test Sans')).toBe(false)
  })
  it('registering a font feeds metrics, the JASSUB URL and the ASS Fontname', () => {
    const p = parseFont(tinyFont())
    setWorkspaceFonts([{ id: 'font_1', family: p.family, filename: 'x.ttf', bytes: 764, metrics: p.metrics }])
    expect(assEmPerFontsize('G3b Test Sans')).toBeCloseTo(1000 / 1200, 6)
    const t = newTextItem('t1', 0, 10_000, 'basic', 'AB a')
    const item = { ...t, style: { ...t.style, font: 'user:font_1' as const, fontFamily: p.family } }
    const ass = buildTextItemsAss({ ...base(), textItems: [item] } as unknown as Record<string, unknown>, 1080, 1920)!
    expect(ass).toMatch(/Style: T0,G3b Test Sans,/)
    expect(fontUrlsForAss(ass)).toEqual(['/api/clips/fonts/font_1/file'])
  })
})

describe('G3b panels', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { fonts: [] } }), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())
  it('Text panel: templates, shapes, stickers, progress add items; no costs shown', () => {
    const onEdits = vi.fn()
    const r = render(<TextPanel edits={base()} onEdits={onEdits} playheadMs={1000} durationMs={20_000} selectedId={null} onSelect={vi.fn()} />)
    fireEvent.click(r.getByTestId('text-template-subscribe'))
    expect((onEdits.mock.calls.at(-1)![0] as ClipEditsV2).textItems!.map((t) => t.kind ?? 'text')).toEqual(['shape', 'text', 'sticker'])
    fireEvent.click(r.getByTestId('text-shape-star'))
    expect((onEdits.mock.calls.at(-1)![0] as ClipEditsV2).textItems![0]).toMatchObject({ kind: 'shape', shape: { type: 'star' } })
    fireEvent.click(r.getByTestId('text-sticker-fire'))
    expect((onEdits.mock.calls.at(-1)![0] as ClipEditsV2).textItems![0]).toMatchObject({ kind: 'sticker', sticker: 'fire' })
    fireEvent.click(r.getByTestId('text-add-progress'))
    expect((onEdits.mock.calls.at(-1)![0] as ClipEditsV2).textItems![0]).toMatchObject({ kind: 'progress', startMs: 0, endMs: 20_000 })
    expect(r.container.textContent).not.toMatch(/\$|credit/i)
  })
  it('Text panel: B / I, letter spacing, line height and gradient controls on text; shape inspector hides text-only ones', () => {
    const onEdits = vi.fn()
    const t = newTextItem('t1', 0, 20_000, 'basic', 'Hello world')
    const e = { ...base(), textItems: [t] }
    const r = render(<TextPanel edits={e} onEdits={onEdits} playheadMs={0} durationMs={20_000} selectedId="t1" onSelect={vi.fn()} />)
    const ta = r.getByTestId('text-content') as HTMLTextAreaElement
    ta.setSelectionRange(6, 11)
    fireEvent.click(r.getByTestId('text-bold'))
    expect((onEdits.mock.calls.at(-1)![0] as ClipEditsV2).textItems![0]!.marks).toEqual([{ s: 6, e: 11, b: true }])
    fireEvent.click(r.getByTestId('text-gradient'))
    expect((onEdits.mock.calls.at(-1)![0] as ClipEditsV2).textItems![0]!.style.gradient).toMatchObject({ dir: 'v' })
    expect(r.getByTestId('text-letter-spacing')).toBeTruthy()
    expect(r.getByTestId('text-line-height')).toBeTruthy()
    expect(r.getByTestId('text-font')).toBeTruthy()
    cleanup()
    const s = newShapeItem('s1', 'rect', 0, 20_000)
    const r2 = render(<TextPanel edits={{ ...base(), textItems: [s] }} onEdits={vi.fn()} playheadMs={0} durationMs={20_000} selectedId="s1" onSelect={vi.fn()} />)
    expect(r2.queryByTestId('text-content')).toBeNull()
    expect(r2.queryByTestId('text-font')).toBeNull()
    expect(r2.queryByTestId('text-box')).toBeNull()
    expect(r2.getByTestId('text-shape-w')).toBeTruthy()
    expect(r2.getByTestId('text-anim').getAttribute('data-layer')).toBe('1')
  })
  it('layer animation section offers whole-layer presets only', () => {
    const r = render(<TextAnimSection layer anim={{ in: { type: 'pop', unit: 'block', durMs: 400 } }} onChange={vi.fn()} />)
    expect(r.queryByTestId('text-anim-in-unit')).toBeNull()
  })
  it('Properties → Animation: B-roll in / out / loop preset is stored on the item', () => {
    const onCommit = vi.fn()
    const b: BrollItem = { id: 'b1', source: 'stock', assetId: 'a', startMs: 0, endMs: 3000, anim: { in: { type: 'pop', unit: 'block', durMs: 400 } } }
    const e = { ...base(), broll: [b] }
    const r = render(
      <PropertiesPanel edits={e} target="broll:b1" label="B-roll" outputMs={0} onCommit={onCommit} onSeekOutput={vi.fn()} cropMode={false} onCropModeChange={vi.fn()} />,
    )
    fireEvent.click(r.getByRole('tab', { name: 'Animation' }))
    expect(r.getByTestId('properties-anim-presets')).toBeTruthy()
    expect(r.getByTestId('text-anim').getAttribute('data-layer')).toBe('1')
  })
})

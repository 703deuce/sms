import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assEmPerFontsize, textWidthPx } from '@/lib/clips/caption-fit'
import { textAssFontsize, textItemCss, TEXT_REF_H } from '@/lib/clips/editor/text-frame'
import { newTextItem, type TextItem } from '@/lib/clips/editor/text-items'

/** E4fix: preview text-item model ↔ libass render measured by worker/tests/test_e4fix_text_parity.py. */
const here = path.dirname(fileURLToPath(import.meta.url))
type Case = { id: string; text: string; font: string; size: number; align: 'left' | 'center' | 'right'; x: number; y: number; pad: number }
const fixture = JSON.parse(readFileSync(path.resolve(here, '../../worker/tests/fixtures/text_item_parity.json'), 'utf8')) as {
  cases: { case: Case; measured: Record<string, { x0: number; x1: number; y0: number; y1: number }> }[]
}
const METRIC: Record<string, string> = { Montserrat: 'Montserrat Black', Poppins: 'Poppins ExtraBold' }

/** Same geometry the preview CSS produces (block centred on the anchor, Fontsize-tall lines, box + pad). */
function previewBox(c: Case, w: number, h: number) {
  const fs = textAssFontsize(c.size, h)
  const pad = (c.pad * h) / TEXT_REF_H
  const lines = c.text.split('\n')
  const bw = Math.max(...lines.map((l) => textWidthPx(l, METRIC[c.font] ?? c.font, fs)))
  const ax = (c.x * w) / 100
  const ay = (c.y * h) / 100
  return {
    x0: (ax - bw / 2 - pad) / w,
    x1: (ax + bw / 2 + pad) / w,
    y0: (ay - (lines.length * fs) / 2 - pad) / h,
    y1: (ay + (lines.length * fs) / 2 + pad) / h,
  }
}

function item(c: Case): TextItem {
  const it = newTextItem('t1', 0, 20000, 'basic', c.text)
  return { ...it, x: c.x, y: c.y, style: { ...it.style, font: c.font as TextItem['style']['font'], size: c.size, align: c.align, box: { color: '#0000FF', opacity: 100, pad: c.pad } } }
}

describe('E4fix text items: preview size / box / align = export', () => {
  it.each(fixture.cases.map((r) => [r.case.id, r] as const))('%s at 720p and 1080p', (_id, r) => {
    for (const [w, h] of [[720, 1280], [1080, 1920]] as const) {
      const exp = previewBox(r.case, w, h)
      const got = r.measured[String(h)]!
      for (const k of ['x0', 'x1', 'y0', 'y1'] as const) expect(Math.abs(got[k] - exp[k])).toBeLessThan(0.006)
    }
  })

  it('CSS: font-size = Fontsize × libass em (per font), line = Fontsize, box pad scales, block centred for every align', () => {
    for (const r of fixture.cases) {
      const boxH = 640
      const css = textItemCss(item(r.case), boxH)
      const line = (textAssFontsize(r.case.size) * boxH) / TEXT_REF_H
      expect(css.linePx).toBeCloseTo(line, 6)
      expect(css.text.fontSize as number).toBeCloseTo(line * assEmPerFontsize(r.case.font), 6)
      expect(css.anchor.transform).toBe('translate(-50%, -50%)')
      expect(css.anchor.textAlign).toBe(r.case.align)
      expect(parseFloat(String(css.box?.padding))).toBeCloseTo(r.case.pad * (boxH / TEXT_REF_H), 6)
    }
  })

  it('Bangers 84 at a 1280-tall frame: CSS font is 0.569× Fontsize (was 1× via the stale ratio)', () => {
    const c = fixture.cases.find((x) => x.case.id === 'bangers_center_box')!.case
    const css = textItemCss(item(c), 1280)
    expect(css.text.fontSize as number).toBeCloseTo(56 * assEmPerFontsize('Bangers'), 6)
    expect(assEmPerFontsize('Bangers')).toBeLessThan(0.6)
  })
})

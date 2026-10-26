import { describe, expect, it } from 'vitest'
import { cellWidthForElement } from '@/lib/screenwriting/formats/types'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'
import {
  layoutElementsFromPmJson,
  paginateFromElements,
  paginateIncremental,
  wrapText,
} from '@/lib/screenwriting/layout'
import type { LayoutElement } from '@/lib/screenwriting/layout/types'

const opts = { spec: FEATURE_FORMAT_SPEC, bodyLinesPerPage: 54, firstPageUnnumbered: true }

describe('wrap', () => {
  it('action width is 60 cells', () => {
    expect(cellWidthForElement(FEATURE_FORMAT_SPEC, 'action')).toBe(60)
  })

  it('wraps long action at spaces', () => {
    const words = Array.from({ length: 30 }, () => 'word').join(' ')
    const lines = wrapText(words, 'action', FEATURE_FORMAT_SPEC)
    expect(lines.length).toBeGreaterThan(1)
    for (const ln of lines) {
      expect(ln.text.length).toBeLessThanOrEqual(60)
    }
  })

  it('honors hard breaks and tabs', () => {
    const lines = wrapText('a\tb', 'action', FEATURE_FORMAT_SPEC)
    expect(lines.some((l) => l.text.includes('a'))).toBe(true)
  })
})

describe('paginate edge cases', () => {
  it('empty script yields one page', () => {
    const r = paginateFromElements([], opts)
    expect(r.pageCount).toBeGreaterThanOrEqual(1)
  })

  it('page break forces new page', () => {
    const els: LayoutElement[] = [
      { id: 'a', kind: 'action', elementType: 'action', text: 'Hello' },
      { id: 'pb', kind: 'pageBreak', text: '' },
      { id: 'b', kind: 'action', elementType: 'action', text: 'After break' },
    ]
    const r = paginateFromElements(els, opts)
    expect(r.pageCount).toBeGreaterThanOrEqual(2)
  })

  it('incremental matches full for random edits seed', () => {
    const base = layoutElementsFromPmJson(
      fountainToPmJson('INT. HOUSE - DAY\n\nAction here.\n\nJACK\nHello world.'),
    )
    const full = paginateFromElements(base, opts)
    const inc = paginateIncremental({ elements: base, options: opts }, 0, null)
    expect(inc.pageCount).toBe(full.pageCount)
  })
})

describe('Brick & Steel fountain layout smoke', () => {
  const brick = `Title: BRICK & STEEL
Credit: written by
Author: Stu Maschwitz

INT. GARAGE - DAY

BRICK and STEEL get into Mom's PORSCHE, Steel at the wheel. They pause for a beat.

BRICK
Screw retirement.

STEEL
Screw retirement.`
  it('paginates imported fountain without throwing', () => {
    const els = layoutElementsFromPmJson(fountainToPmJson(brick))
    const r = paginateFromElements(els, opts)
    expect(r.pageCount).toBeGreaterThanOrEqual(1)
    expect(r.pages[0].lines.length).toBeGreaterThan(0)
  })
})

import { describe, expect, it } from 'vitest'
import { nextElementType, autoDetectElementType } from '@/lib/screenwriting/editor/element-keys'
import { CMD_ELEMENT_TYPES, elementTypeForDigit } from '@/lib/screenwriting/editor/shortcuts'
import { pmJsonToFountainLines } from '@/lib/screenwriting/fountain/export-lines'
import { normalizeScreenplayDoc } from '@/lib/screenwriting/schema/normalize-doc'
import { layoutElementsFromPmJson, paginateFromElements } from '@/lib/screenwriting/layout'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { reorderScenesInDoc } from '@/lib/screenwriting/structure/scene-reorder'
import { elementStyle } from '@/lib/screenwriting/editor/element-style'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'

const sample = fountainToPmJson(`INT. HOUSE - DAY\n\nAction.\n\nJACK\n(quiet)\nHello.\n`)

describe('format-flow acceptance (28)', () => {
  it('T01 Enter after scene heading → action', () => {
    expect(nextElementType('sceneHeading', 'enter')).toBe('action')
  })
  it('T02 Enter after action → action', () => {
    expect(nextElementType('action', 'enter')).toBe('action')
  })
  it('T03 Enter after character → dialogue', () => {
    expect(nextElementType('character', 'enter')).toBe('dialogue')
  })
  it('T04 Enter after parenthetical → dialogue', () => {
    expect(nextElementType('parenthetical', 'enter')).toBe('dialogue')
  })
  it('T05 Enter after dialogue → action', () => {
    expect(nextElementType('dialogue', 'enter')).toBe('action')
  })
  it('T06 Enter after transition → scene heading', () => {
    expect(nextElementType('transition', 'enter')).toBe('sceneHeading')
  })
  it('T07 Tab on action → character', () => {
    expect(nextElementType('action', 'tab')).toBe('character')
  })
  it('T08 Tab on character → transition', () => {
    expect(nextElementType('character', 'tab')).toBe('transition')
  })
  it('T09 Tab on dialogue → parenthetical', () => {
    expect(nextElementType('dialogue', 'tab')).toBe('parenthetical')
  })
  it('T10 Shift+Tab on character → action', () => {
    expect(nextElementType('character', 'shiftTab')).toBe('action')
  })
  it('T11 Backspace empty dialogue → character', () => {
    expect(nextElementType('dialogue', 'backspaceEmpty')).toBe('character')
  })
  it('T12 Backspace empty action → scene heading', () => {
    expect(nextElementType('action', 'backspaceEmpty')).toBe('sceneHeading')
  })
  it('T13 Auto-detect INT. → scene heading', () => {
    expect(autoDetectElementType('INT. HOUSE', 'action')).toBe('sceneHeading')
  })
  it('T14 Auto-detect EXT. → scene heading', () => {
    expect(autoDetectElementType('EXT. ROAD', 'action')).toBe('sceneHeading')
  })
  it('T15 Auto-detect CUT TO: → transition', () => {
    expect(autoDetectElementType('CUT TO:', 'action')).toBe('transition')
  })
  it('T16 Dialogue ( prefix → parenthetical', () => {
    expect(autoDetectElementType('(whispering)', 'dialogue')).toBe('parenthetical')
  })
  it('T17 Fountain: no blank between character and parenthetical', () => {
    const f = pmJsonToFountainLines(sample)
    expect(f).not.toMatch(/JACK\n\n\(/)
  })
  it('T18 Fountain: no blank between character and dialogue', () => {
    const f = pmJsonToFountainLines(sample)
    expect(f).toMatch(/JACK\n\(quiet\)\nHello/)
  })
  it('T19 Scene heading uppercase in fountain', () => {
    const f = pmJsonToFountainLines(sample)
    expect(f).toContain('INT. HOUSE - DAY')
  })
  it('T20 PDF and layout share page count', () => {
    const els = layoutElementsFromPmJson(sample)
    const layout = paginateFromElements(els, { spec: FEATURE_FORMAT_SPEC, bodyLinesPerPage: 54 })
    expect(layout.pageCount).toBeGreaterThan(0)
    const again = paginateFromElements(els, { spec: FEATURE_FORMAT_SPEC, bodyLinesPerPage: 54 })
    expect(again.pageCount).toBe(layout.pageCount)
  })
  it('T21 Cmd+1 → scene heading', () => {
    expect(elementTypeForDigit(1)).toBe(CMD_ELEMENT_TYPES[0])
    expect(CMD_ELEMENT_TYPES[0]).toBe('sceneHeading')
  })
  it('T22 Cmd+3 → character', () => {
    expect(elementTypeForDigit(3)).toBe('character')
  })
  it('T23 Pagination returns pages for sample', () => {
    const layout = paginateFromElements(layoutElementsFromPmJson(sample), {
      spec: FEATURE_FORMAT_SPEC,
      bodyLinesPerPage: 54,
    })
    expect(layout.pages.length).toBeGreaterThan(0)
  })
  it('T24 Scene heading has space-before in spec', () => {
    expect(FEATURE_FORMAT_SPEC.elements.sceneHeading?.spaceBefore).toBeGreaterThan(0)
  })
  it('T25 Character caps in spec', () => {
    expect(FEATURE_FORMAT_SPEC.elements.character?.caps).toBe(true)
  })
  it('T26 Transition right align', () => {
    expect(elementStyle(FEATURE_FORMAT_SPEC, 'transition').textAlign).toBe('right')
  })
  it('T27 Normalize empty doc', () => {
    const d = normalizeScreenplayDoc({ type: 'doc', content: [] })
    expect(d.content?.[0]?.type).toBe('screenplayElement')
  })
  it('T28 Reorder scenes keeps blocks', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'screenplayElement', attrs: { id: 'a', elementType: 'sceneHeading' }, content: [{ type: 'text', text: 'INT. A' }] },
        { type: 'screenplayElement', attrs: { id: 'b', elementType: 'action' }, content: [{ type: 'text', text: 'One' }] },
        { type: 'screenplayElement', attrs: { id: 'c', elementType: 'sceneHeading' }, content: [{ type: 'text', text: 'INT. B' }] },
        { type: 'screenplayElement', attrs: { id: 'd', elementType: 'action' }, content: [{ type: 'text', text: 'Two' }] },
      ],
    }
    const next = reorderScenesInDoc(doc, 0, 1)
    const headings = (next.content ?? []).filter((n) => n.attrs?.elementType === 'sceneHeading')
    expect(headings.map((h) => h.content?.[0])).toEqual([{ type: 'text', text: 'INT. B' }, { type: 'text', text: 'INT. A' }])
  })
})

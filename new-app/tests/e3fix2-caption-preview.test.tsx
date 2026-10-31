// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { defaultEdits, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(path.resolve(here, '../../worker/tests/fixtures/caption_fit_parity.json'), 'utf8'),
) as { cases: { id: string; text: string; captions: ClipEditsV2['captions']; expected: { n: number; breaks: number[]; pct: number }[] }[] }
const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

function renderCase(id: string, chunk: number) {
  const c = fixture.cases.find((x) => x.id === id)!
  const words = c.text.split(/\s+/).map((w, i) => ({ w, s: i * 0.5, e: i * 0.5 + 0.4, idx: i })) as ClipWord[]
  // Exactly the captions object the worker fixture fed build_ass (no default merge).
  const edits = { ...defaultEdits(bounds), captions: c.captions } as ClipEditsV2
  const start = c.expected.slice(0, chunk).reduce((s, x) => s + x.n, 0)
  const r = render(<CaptionOverlay words={words} currentTimeSec={start * 0.5 + 0.1} edits={edits} boxHeightPx={640} />)
  return { r, exp: c.expected[chunk]! }
}

describe('E3fix2: preview caption lines break like the export ASS', () => {
  afterEach(() => cleanup())

  it('Ludwig repro "Energy, capital, whatever." → 2 rows, break before "whatever."', () => {
    const { r, exp } = renderCase('ludwig_bold_pop_montserrat', 0)
    expect(exp.breaks).toEqual([2])
    const line = r.getByTestId('caption-line')
    expect(line.getAttribute('data-breaks')).toBe('2')
    const rows = r.getAllByTestId('caption-row')
    // EP1: words are separated by a real space (libass spacing), not CSS gaps.
    expect(rows.map((x) => x.textContent)).toEqual(['Energy, capital,', 'whatever.'])
    expect(line.style.maxWidth).toBe('90%')
  })

  it.each([
    ['font_Archivo Black', 0],
    ['aspect_4:5', 1],
    ['shrink_single_word', 0],
    ['preset_boxed', 0],
  ] as const)('%s chunk %i: same breaks + shrink as export', (id, chunk) => {
    const { r, exp } = renderCase(id, chunk)
    const line = r.getByTestId('caption-line')
    expect(line.getAttribute('data-breaks')).toBe(exp.breaks.join(','))
    expect(r.getAllByTestId('caption-row')).toHaveLength(exp.breaks.length + 1)
    const scale = Number(line.getAttribute('data-fit-scale'))
    expect(scale < 0.999 ? Math.floor(scale * 100 + 0.5) : 100).toBe(exp.pct)
  })
})

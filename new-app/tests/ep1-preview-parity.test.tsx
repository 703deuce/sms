// @vitest-environment happy-dom
/** EP1: the editor preview uses the shared title fit, badge rule and libass word spacing. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { TemplateTitleOverlay } from '@/components/clips/editor/template-stage'
import { ExportTemplateOverlay } from '@/components/clips/export-template-overlay'
import type { ClipEditsV2 } from '@/lib/clips/edits'

const here = path.dirname(fileURLToPath(import.meta.url))
const CASES = JSON.parse(readFileSync(path.resolve(here, '../../worker/tests/fixtures/render_plan/cases.json'), 'utf8'))

afterEach(() => cleanup())

describe('EP1 preview parity', () => {
  it('caption words are separated by one real space (no CSS gap / padding)', () => {
    const words = 'one two three'.split(' ').map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.35, idx: i }))
    const edits = {
      v: 2, trim: { in: 0, out: 9999 }, cutRanges: [], wordFixes: {}, layout: { mode: 'speaker_follow', shotOverrides: [] },
      captions: { enabled: true, presetId: 'bold_pop', wordsPerLine: 3, animation: 'none' },
    } as unknown as ClipEditsV2
    const r = render(<CaptionOverlay words={words as never} currentTimeSec={0.1} edits={edits} boxHeightPx={640} />)
    const row = r.getAllByTestId('caption-row')[0]!
    expect(row.className).not.toContain('gap-x')
    expect(row.innerHTML).not.toContain('px-1')
    expect(row.textContent).toBe('ONE TWO THREE')
  })

  it('template title: Ludwig headline is 2 lines at the export Fontsize (title_fit golden)', () => {
    const golden = readFileSync(path.resolve(here, '../../worker/tests/fixtures/render_plan/title_ludwig_band.ass'), 'utf8')
    const fs = Number(/Style: Title,Anton,(\d+),/.exec(golden)![1])
    const r = render(
      <TemplateTitleOverlay
        spec={{ playW: 1080, playH: 1920, titleRect: { x: 0, y: 0, w: 1080, h: 384 } } as never}
        text="Let's just dip—Valorant isn't worth it"
        styleId="white_on_black"
        boxWidth={405}
      />,
    )
    const el = r.getByTestId('template-title')
    expect(el.getAttribute('data-title-lines')).toBe('2')
    expect(Number(el.getAttribute('data-title-fontsize'))).toBe(fs)
  })

  it('badge: clip_fc4ac0ba (T6 template) shows 2XRAKAI above the title band', () => {
    const c = CASES.badge.find((x: { name: string }) => x.name === 'ludwig_clip_fc4ac0ba')
    const r = render(<ExportTemplateOverlay edits={c.edits as ClipEditsV2} boxWidth={405} boxHeight={720} hideHeadline />)
    expect(r.container.textContent).toContain('2XRAKAI')
    const root = r.container.firstElementChild as HTMLElement
    expect(root.className).toContain('z-[27]')
  })
})

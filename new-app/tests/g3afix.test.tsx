// @vitest-environment happy-dom
/** G3afix (live check of G3a / PR 832): out-slide labels/direction, SRT/VTT multi-line + <i>/<b>, Replace/Append, stale message. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { CaptionLinesPanel } from '@/components/clips/editor/caption-lines-panel'
import { IN_LABEL, OUT_LABEL, TextAnimSection } from '@/components/clips/editor/text-anim-section'
import {
  appendCaptionLines,
  captionLineClipWords,
  captionLinesToSrt,
  captionLinesToTxt,
  captionLinesToVtt,
  captionLineWords,
  lineTokens,
  mergeCaptionLineWithNext,
  normalizeCaptionLines,
  parseSubtitles,
  rechunkCaptionLines,
  serializeTokens,
  splitCaptionLine,
  type CaptionLine,
} from '@/lib/clips/editor/caption-lines'
import { buildCaptionsAss } from '@/lib/clips/render-plan/captions-ass'
import { buildPreviewScripts } from '@/lib/clips/render-plan/preview-scripts'
import { frameAnim, normAnim, OUT_MOTION } from '@/lib/clips/render-plan/text-anim'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'

afterEach(cleanup)
const FIX = join(__dirname, '../../worker/tests/fixtures/render_plan')
const L = (id: string, text: string, startMs: number, endMs: number): CaptionLine => ({ id, text, startMs, endMs })

describe('G3afix 1 — out slides: label, stored value and motion agree', () => {
  it.each([
    ['slide_up', 'dy', -1, /up/i],
    ['slide_down', 'dy', 1, /down/i],
    ['slide_left', 'dx', -1, /left/i],
    ['slide_right', 'dx', 1, /right/i],
  ] as const)('%s exits along %s', (typ, axis, sign, word) => {
    expect(OUT_LABEL[typ]).toMatch(word)
    expect(IN_LABEL[typ]).toMatch(word)
    const anim = normAnim({ out: { type: typ, durMs: 400 } })!
    const nearEnd = frameAnim(anim, 1990, 0, 2000, 0, 400)
    const mid = frameAnim(anim, 1800, 0, 2000, 0, 400)
    expect(nearEnd[axis] * sign).toBeGreaterThan(mid[axis] * sign)
    expect(mid[axis] * sign).toBeGreaterThan(0)
  })
  it('the Out select shows the stored value by the direction it exits', () => {
    const { getByTestId } = render(<TextAnimSection anim={{ out: { type: 'slide_down', unit: 'block', durMs: 400 } }} onChange={vi.fn()} />)
    expect(getByTestId('text-anim-out-type').textContent).toMatch(/slide down/i)
    expect(getByTestId('text-anim-out-type').textContent).not.toMatch(/up/i)
    expect(OUT_MOTION.slide_down).toBe('slide_up')
  })
})

describe('G3afix 2 — multi-line cues and <i>/<b> == worker caption_lines.py', () => {
  const exp = JSON.parse(readFileSync(join(FIX, 'caption_lines_rich_expected.json'), 'utf8'))
  it('normalize / words / render words / SRT match the worker fixture', () => {
    expect(normalizeCaptionLines(exp.lines)).toEqual(exp.normalized)
    expect(captionLineWords(exp.lines)).toEqual(exp.words)
    expect(captionLineClipWords(exp.lines).map(({ i: _i, ...r }) => r)).toEqual(exp.render)
    expect(captionLinesToSrt(exp.lines)).toBe(exp.srt)
  })
  it('the old G3a plain fixture is unchanged', () => {
    const old = JSON.parse(readFileSync(join(FIX, 'caption_lines_expected.json'), 'utf8'))
    expect(captionLineWords(old.lines)).toEqual(old.words)
    expect(captionLinesToSrt(old.lines)).toBe(old.srt)
  })
  it('SRT import keeps the cue lines and <i>/<b>; other tags are stripped', () => {
    const srt = '1\r\n00:00:00,000 --> 00:00:02,000\r\nHello from the SRT test\r\nsecond line here\r\n\r\n2\r\n00:00:02,000 --> 00:00:03,500\r\n<i>slanted</i> <font color="red">red</font> <B>heavy</B>\r\n'
    const lines = parseSubtitles(srt)
    expect(lines.map((l) => l.text)).toEqual(['Hello from the SRT test\nsecond line here', '<i>slanted</i> red <b>heavy</b>'])
    expect(captionLinesToSrt(lines)).toContain('Hello from the SRT test\nsecond line here\n')
    expect(captionLinesToVtt(lines)).toContain('Hello from the SRT test\nsecond line here\n')
    expect(captionLinesToTxt(lines)).toBe('Hello from the SRT test second line here\nslanted red heavy\n')
  })
  it('VTT import: voice/class tags dropped, <i> kept, line break kept', () => {
    const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.500 align:center\n<v Bob>Hi <c.yellow>there</c></v>\n<i>friend</i>\n'
    expect(parseSubtitles(vtt).map((l) => l.text)).toEqual(['Hi there\n<i>friend</i>'])
  })
  it('caption ASS: the cue break is a \\N and <i> is {\\i1}; the preview keeps one caption per line', () => {
    const lines = [L('a', '<i>one two</i>\nthree', 0, 1500), L('b', 'four five six seven', 1500, 3000)]
    const ass = buildCaptionsAss(captionLineClipWords(lines), { presetId: 'clean_white', wordsPerLine: 1 }, 1080, 1080)
    const ev = ass.split('\n').filter((l) => l.startsWith('Dialogue'))
    expect(ev.filter((l) => l.includes('\\N') && l.includes('{\\i1}')).length).toBeGreaterThan(0)
    const d = defaultEdits({ clipStartMs: 0, clipEndMs: 5000 })
    const edits = { ...d, captionLines: lines, captions: { ...d.captions, enabled: true, presetId: 'clean_white', wordsPerLine: 1 } }
    const scripts = buildPreviewScripts({ edits: edits as unknown as Record<string, unknown>, words: captionLineClipWords(lines), playW: 1080, playH: 1080, durationMs: 5000 } as never)
    const cap = String((scripts as unknown as Record<string, unknown>).captions ?? '')
    expect(cap).toContain('{\\i1}')
    // G3a dropped `ln` in buildPreviewScripts, so the preview re-chunked manual lines by words per line
    expect(cap.split('\n').some((l) => l.startsWith('Dialogue') && /four/i.test(l) && /seven/i.test(l))).toBe(true)
  })
  it('re-chunk only on request; split / merge keep tags', () => {
    const lines = [L('a', '<i>one two three</i>\nfour five', 0, 2000)]
    const re = rechunkCaptionLines(lines, 2)
    expect(re.map((l) => l.text)).toEqual(['<i>one two</i>', '<i>three</i> four', 'five'])
    expect(re[0]!.startMs).toBe(0)
    expect(re.at(-1)!.endMs).toBe(2000)
    const sp = splitCaptionLine(lines, 'a', { charIndex: '<i>one two'.length })
    expect(sp.map((l) => l.text)).toEqual(['<i>one two</i>', '<i>three</i>\nfour five'])
    const mg = mergeCaptionLineWithNext([L('a', '<b>x</b>', 0, 500), L('b', 'y\nz', 500, 1000)], 'a')
    expect(mg[0]!.text).toBe('<b>x</b> y\nz')
    expect(serializeTokens(lineTokens('wo<i>rd</i>'))).toBe('word')
  })
  it('append fills gaps without overlapping existing lines', () => {
    const have = [L('a', 'keep', 1000, 2000)]
    const got = appendCaptionLines(have, [L('x', 'early', 0, 1500), L('y', 'inside', 1200, 1800), L('z', 'late', 1900, 3000)])
    expect(got.map((l) => [l.text, l.startMs, l.endMs])).toEqual([['early', 0, 1000], ['keep', 1000, 2000], ['late', 2000, 3000]])
  })
})

const base = (lines?: CaptionLine[]): ClipEditsV2 => ({ ...defaultEdits({ clipStartMs: 0, clipEndMs: 20_000 }), captionLines: lines })
const SRT = '1\n00:00:00,000 --> 00:00:01,000\nnew one\n\n2\n00:00:05,000 --> 00:00:06,000\nnew two\n'
function upload(input: HTMLElement, body: string) {
  const file = new File([body], 'a.srt', { type: 'application/x-subrip' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

describe('G3afix 3/4 — import asks Replace or Append; no stale message', () => {
  it('no manual lines: imports straight away', async () => {
    const onEdits = vi.fn()
    const r = render(<CaptionLinesPanel edits={base()} words={[]} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    upload(r.getByTestId('caption-lines-file'), SRT)
    await waitFor(() => expect(onEdits).toHaveBeenCalled())
    expect(r.queryByTestId('caption-lines-import-choice')).toBeNull()
    expect((onEdits.mock.calls[0]![0] as ClipEditsV2).captionLines!.map((l) => l.text)).toEqual(['new one', 'new two'])
  })
  it('existing lines: nothing changes until Replace / Append is picked', async () => {
    const onEdits = vi.fn()
    const have = [L('a', 'mine', 2000, 3000)]
    const r = render(<CaptionLinesPanel edits={base(have)} words={[]} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    upload(r.getByTestId('caption-lines-file'), SRT)
    await waitFor(() => expect(r.getByTestId('caption-lines-import-choice')).toBeTruthy())
    expect(onEdits).not.toHaveBeenCalled()
    fireEvent.click(r.getByTestId('caption-lines-import-append'))
    expect((onEdits.mock.calls[0]![0] as ClipEditsV2).captionLines!.map((l) => l.text)).toEqual(['new one', 'mine', 'new two'])
    upload(r.getByTestId('caption-lines-file'), SRT)
    await waitFor(() => expect(r.getByTestId('caption-lines-import-choice')).toBeTruthy())
    fireEvent.click(r.getByTestId('caption-lines-import-replace'))
    expect((onEdits.mock.calls[1]![0] as ClipEditsV2).captionLines!.map((l) => l.text)).toEqual(['new one', 'new two'])
    upload(r.getByTestId('caption-lines-file'), SRT)
    await waitFor(() => expect(r.getByTestId('caption-lines-import-choice')).toBeTruthy())
    fireEvent.click(r.getByTestId('caption-lines-import-cancel'))
    expect(r.queryByTestId('caption-lines-import-choice')).toBeNull()
    expect(onEdits).toHaveBeenCalledTimes(2)
    expect(r.container.textContent).not.toMatch(/\$/)
  })
  it('"Imported N lines." is cleared by Remove manual lines', async () => {
    const onEdits = vi.fn()
    const r = render(<CaptionLinesPanel edits={base()} words={[]} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    upload(r.getByTestId('caption-lines-file'), SRT)
    await waitFor(() => expect(r.getByTestId('caption-lines-msg').textContent).toMatch(/Imported 2 lines/))
    r.rerender(<CaptionLinesPanel edits={onEdits.mock.calls[0]![0]} words={[]} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    fireEvent.click(r.getByTestId('caption-lines-clear'))
    expect(r.queryByTestId('caption-lines-msg')).toBeNull()
  })
  it('re-split option is off by default and re-chunks when ticked', async () => {
    const onEdits = vi.fn()
    const b = base()
    const e = { ...b, captions: { ...b.captions, wordsPerLine: 1 } }
    const r = render(<CaptionLinesPanel edits={e} words={[]} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    expect((r.getByTestId('caption-lines-rechunk-toggle') as HTMLInputElement).checked).toBe(false)
    fireEvent.click(r.getByTestId('caption-lines-rechunk-toggle'))
    upload(r.getByTestId('caption-lines-file'), SRT)
    await waitFor(() => expect(onEdits).toHaveBeenCalled())
    expect((onEdits.mock.calls[0]![0] as ClipEditsV2).captionLines!.map((l) => l.text)).toEqual(['new', 'one', 'new', 'two'])
  })
})

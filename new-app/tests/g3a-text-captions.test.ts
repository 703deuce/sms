import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  addTypedLines,
  captionLineClipWords,
  captionLinesFromWords,
  captionLinesToSrt,
  captionLinesToTxt,
  captionLinesToVtt,
  captionLineWords,
  mergeCaptionLineWithNext,
  normalizeCaptionLinesEdits,
  parseSubtitles,
  splitCaptionLine,
  type CaptionLine,
} from '@/lib/clips/editor/caption-lines'
import { buildTimelineItems, deleteItems, moveItems, splitAt, timelineRows, trimItem } from '@/lib/clips/editor/clip-timeline'
import { normalizeTextItems } from '@/lib/clips/editor/text-items'
import { editorPreviewCaptionClipWords } from '@/lib/clips/editor-preview-edits'
import { normAnim, fitDurations } from '@/lib/clips/render-plan/text-anim'
import { buildTextItemsAss } from '@/lib/clips/render-plan/text-items-ass'
import { buildCaptionsAss, captionMinMarginVPct, clampCaptionExportStyle } from '@/lib/clips/render-plan/captions-ass'
import { clampCaptionExportStyle as clampPreview } from '@/lib/clips/caption-safe-area'
import { patchAnim, unitsFor } from '@/components/clips/editor/text-anim-section'
import { captionLayoutsFor } from '@/components/clips/editor/caption-lines-panel'

const FIX = join(__dirname, '..', '..', 'worker', 'tests', 'fixtures', 'render_plan')
const bounds = { clipStartMs: 0, clipEndMs: 20_000 }
const base = (): ClipEditsV2 => defaultEdits(bounds)
const L = (id: string, text: string, startMs: number, endMs: number): CaptionLine => ({ id, text, startMs, endMs })

describe('G3a manual caption lines == worker caption_lines.py', () => {
  const exp = JSON.parse(readFileSync(join(FIX, 'caption_lines_expected.json'), 'utf8'))
  it('words / render words / SRT match the worker fixture', () => {
    expect(captionLineWords(exp.lines)).toEqual(exp.words)
    const r = captionLineClipWords(exp.lines).map(({ w, s, e, idx, ln }) => ({ w, s, e, idx, ln }))
    expect(r).toEqual(exp.render)
    expect(captionLinesToSrt(exp.lines)).toBe(exp.srt)
  })
  it('the caption ASS shows one caption per line (no wordsPerLine split)', () => {
    const ass = buildCaptionsAss(captionLineClipWords([L('a', 'one two three four five', 0, 2000)]), { presetId: 'clean_white', wordsPerLine: 2 }, 1080, 1920)
    const ev = ass.split('\n').filter((l) => l.startsWith('Dialogue'))
    expect(ev.every((l) => /ONE|One|one/.test(l) && /five/i.test(l))).toBe(true)
  })
  it('edits keep lines (ids made unique), payload clears them, preview reuse is off', () => {
    const e = normalizeEdits({ ...base(), captionLines: [L('a', ' hi  there ', 0, 900), L('a', 'again', 800, 1500), L('bad id!', 'x', 2000, 2050)] }, bounds)
    expect(e.captionLines).toEqual([L('a', 'hi there', 0, 900), { id: 'cl1_900', text: 'again', startMs: 900, endMs: 1500 }])
    expect(isDefaultEdits(e, bounds)).toBe(false)
    expect(editsPayloadForSave({ ...e, captionLines: undefined }).captionLines).toBeNull()
    expect(normalizeEdits({ ...base(), captionLines: [] }, bounds).captionLines).toBeUndefined()
  })
  it('preview captions use the lines (ln) instead of the transcript', () => {
    const words = [{ i: 0, w: 'spoken', s: 0, e: 0.5 }]
    const e = { ...base(), captionLines: [L('a', 'typed words', 0, 1000)] }
    expect(editorPreviewCaptionClipWords(words, e).map((w) => [w.w, (w as { ln?: number }).ln])).toEqual([['typed', 0], ['words', 0]])
    expect(editorPreviewCaptionClipWords(words, base()).map((w) => w.w)).toEqual(['spoken'])
  })
})

describe('G3a SRT / VTT / TXT', () => {
  it('parses SRT (BOM, CRLF, tags, multi-line cues) and VTT (mm:ss.mmm, cue ids, header)', () => {
    const srt = '\uFEFF1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>Hello</i> {\\an8}there\r\nfriend\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nBye\r\n'
    expect(parseSubtitles(srt).map(({ text, startMs, endMs }) => [text, startMs, endMs])).toEqual([['<i>Hello</i> there\nfriend', 1000, 2500], ['Bye', 3000, 4000]]) // G3afix: cue lines + <i> kept
    const vtt = 'WEBVTT\n\nintro\n00:01.000 --> 00:02.000 align:start\nHi\n\n00:00:02.5 --> 00:00:03.000\nYo\n'
    expect(parseSubtitles(vtt, { durationMs: 2800 }).map(({ text, startMs, endMs }) => [text, startMs, endMs])).toEqual([['Hi', 1000, 2000], ['Yo', 2500, 2800]])
  })
  it('writes SRT / VTT / TXT', () => {
    const lines = [L('a', 'One', 0, 1234), L('b', 'Two', 61_000, 3_723_004)]
    expect(captionLinesToSrt(lines)).toBe('1\n00:00:00,000 --> 00:00:01,234\nOne\n\n2\n00:01:01,000 --> 01:02:03,004\nTwo\n')
    expect(captionLinesToVtt(lines)).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:01.234\nOne\n\n00:01:01.000 --> 01:02:03.004\nTwo\n')
    expect(captionLinesToTxt(lines)).toBe('One\nTwo\n')
    expect(parseSubtitles(captionLinesToSrt(lines)).map((l) => [l.text, l.startMs, l.endMs])).toEqual([['One', 0, 1234], ['Two', 61_000, 3_723_004]])
  })
})

describe('G3a line editing', () => {
  it('typed lines go back to back from the playhead at reading speed, around existing lines', () => {
    const out = addTypedLines([L('x', 'existing', 2000, 3000)], 'first line here\nsecond', 1500, 10_000)
    expect(out.map((l) => [l.text, l.startMs, l.endMs])).toEqual([
      ['first line here', 1500, 2000],
      ['existing', 2000, 3000],
      ['second', 3000, 3800],
    ])
  })
  it('split at the caret / at a time, merge with next', () => {
    const lines = [L('a', 'alpha beta gamma delta', 0, 2000), L('b', 'tail', 2000, 3000)]
    const s1 = splitCaptionLine(lines, 'a', { charIndex: 11 })
    expect(s1.map((l) => [l.text, l.startMs, l.endMs])).toEqual([['alpha beta', 0, 957], ['gamma delta', 957, 2000], ['tail', 2000, 3000]])
    const s2 = splitCaptionLine(lines, 'a', { ms: 500 })
    expect(s2[0]!.text).toBe('alpha')
    expect(s2[0]!.endMs).toBe(500)
    expect(splitCaptionLine([L('c', 'single', 0, 1000)], 'c')).toHaveLength(1)
    expect(mergeCaptionLineWithNext(lines, 'a').map((l) => [l.text, l.startMs, l.endMs])).toEqual([['alpha beta gamma delta tail', 0, 3000]])
  })
  it('auto captions → lines use the wordsPerLine chunks', () => {
    const w = [
      { text: 'a', s_ms: 0, e_ms: 200 },
      { text: 'b', s_ms: 250, e_ms: 400 },
      { text: 'c', s_ms: 500, e_ms: 700 },
    ]
    expect(captionLinesFromWords(w, 2).map((l) => [l.text, l.startMs, l.endMs])).toEqual([['a b', 0, 400], ['c', 500, 700]])
  })
})

describe('G3a Captions timeline row', () => {
  const edits = (): ClipEditsV2 => ({ ...base(), captionLines: normalizeCaptionLinesEdits([L('a', 'one two', 1000, 2000), L('b', 'three four', 3000, 4000)]) })
  const ctx = (e: ClipEditsV2) => ({ edits: e, previewEdits: e })
  it('row only with lines; items carry the line text', () => {
    expect(timelineRows(base()).some((r) => r.lane === 'captions')).toBe(false)
    expect(timelineRows(edits())[0]!.lane).toBe('captions')
    expect(buildTimelineItems({ edits: edits(), previewEdits: edits() }).captions.map((i) => i.label)).toEqual(['one two', 'three four'])
  })
  it('move / trim stop at the neighbour; split at playhead; delete', () => {
    const e = edits()
    expect(moveItems(ctx(e), [{ lane: 'captions', id: 'a' }], 5000)!.captionLines![0]).toMatchObject({ startMs: 2000, endMs: 3000 })
    expect(trimItem(ctx(e), { lane: 'captions', id: 'a' }, 'end', 3500)!.captionLines![0]!.endMs).toBe(3000)
    expect(trimItem(ctx(e), { lane: 'captions', id: 'b' }, 'start', 100)!.captionLines![1]!.startMs).toBe(2000)
    const sp = splitAt(ctx(e), [{ lane: 'captions', id: 'b' }], 3500)!
    expect(sp.captionLines!.map((l) => l.text)).toEqual(['one two', 'three', 'four'])
    const del = deleteItems(ctx(e), [{ lane: 'captions', id: 'a' }, { lane: 'captions', id: 'b' }])!
    expect(del.captionLines).toBeUndefined()
  })
  it('a locked Captions row is not editable', () => {
    const e = { ...edits(), timelineLanes: { captions: { locked: true } } }
    expect(moveItems(ctx(e), [{ lane: 'captions', id: 'a' }], 100)).toBeNull()
  })
})

describe('G3a text animations', () => {
  it('normAnim / fitDurations', () => {
    expect(normAnim({ in: { type: 'pop', unit: 'word', durMs: 333.5 }, loop: { type: 'nope' } })).toEqual({ in: { type: 'pop', unit: 'word', durMs: 334 } })
    expect(normAnim({ out: { type: 'zoom', unit: 'char', durMs: '300' } })).toEqual({ out: { type: 'zoom', unit: 'block', durMs: 500 } })
    expect(fitDurations({ in: { type: 'fade', unit: 'block', durMs: 900 }, out: { type: 'fade', unit: 'block', durMs: 300 } }, 600)).toEqual([450, 150])
  })
  it('text items keep a valid anim through the edits normalizer', () => {
    const items = normalizeTextItems([{ id: 't1', text: 'Hi', startMs: 0, endMs: 1000, anim: { in: { type: 'typewriter', durMs: 800 }, junk: 1 } }])!
    expect(items[0]!.anim).toEqual({ in: { type: 'typewriter', unit: 'char', durMs: 800 } })
    expect(normalizeTextItems([{ id: 't1', text: 'Hi', startMs: 0, endMs: 1000, anim: { in: { type: 'x' } } }])![0]!.anim).toBeUndefined()
  })
  it('panel helpers: units per type, patch / clear', () => {
    expect(unitsFor('slide_up')).toEqual(['block'])
    expect(unitsFor('typewriter')).toEqual(['char', 'word', 'line'])
    const a = patchAnim(undefined, { in: { type: 'fade', unit: 'word', durMs: 400 } })
    expect(a).toEqual({ in: { type: 'fade', unit: 'word', durMs: 400 } })
    expect(patchAnim(a, { clear: 'in' })).toBeUndefined()
  })
  it('fade in / out: per-frame windows, one static middle event', () => {
    const ass = buildTextItemsAss(
      { textItems: [{ id: 't1', text: 'HELLO', startMs: 0, endMs: 2000, x: 50, y: 50, style: { font: 'Montserrat', size: 200 }, anim: { in: { type: 'fade', durMs: 500 }, out: { type: 'fade', durMs: 500 } } }] },
      1080,
      1920,
    )!
    const ev = ass.split('\n').filter((l) => l.startsWith('Dialogue'))
    expect(ev).toHaveLength(31)
    expect(ev.filter((l) => l.endsWith('{\\an5\\pos(540,960)}HELLO'))).toEqual(['Dialogue: 1,0:00:00.50,0:00:01.50,T0,,0,0,0,,{\\an5\\pos(540,960)}HELLO'])
  })
})

describe('G3a aspect-aware caption safe area', () => {
  it.each([
    [1080, 1920, 12],
    [1080, 1350, 10],
    [1080, 1080, 8],
    [1920, 1080, 6],
  ])('%ix%i → min margin %i%% (export ASS == preview)', (w, h, m) => {
    expect(captionMinMarginVPct(w, h)).toBe(m)
    expect(clampCaptionExportStyle({ presetId: 'clean_white', marginVPct: 4 }, h, w).marginVPct).toBe(m)
    expect(clampPreview({ ...base().captions, marginVPct: 4 }, h, w).marginVPct).toBe(m)
  })
  it('without a width the 9:16 rule stays (12 %)', () => {
    expect(clampCaptionExportStyle({ marginVPct: 6 }, 1920).marginVPct).toBe(12)
  })
  it('layouts per aspect stay inside the normalizer ranges', () => {
    for (const a of ['9:16', '16:9', '1:1', '4:5']) {
      for (const l of captionLayoutsFor(a)) {
        const c = normalizeEdits({ ...base(), aspectRatio: a, captions: { ...base().captions, ...l.captions } }, bounds).captions
        if (l.captions.marginVPct !== undefined) expect(c.marginVPct).toBe(l.captions.marginVPct)
        if (l.captions.wordsPerLine !== undefined) expect(c.wordsPerLine).toBe(l.captions.wordsPerLine)
      }
    }
  })
})

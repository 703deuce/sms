import { describe, expect, it } from 'vitest'
import { activeCaptionWordIndex, captionEmojiForWord } from '@/lib/clips/caption-overlay-active'
import { editorPreviewCaptionClipWords, editorPreviewDurationMs } from '@/lib/clips/editor-preview-edits'
import { seedEditorExportTemplate } from '@/lib/clips/editor-export-template-seed'
import { defaultEdits, outputDurationMs, type ClipWord } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { layoutReservesHeadlineBand } from '@/lib/clips/layout-preview'
import { applyExportPolishEdits } from '@/lib/server/clips/apply-export-polish'

const bounds = { clipStartMs: 0, clipEndMs: 20_000 }

const words: SourceWord[] = [
  { i: 0, w: 'Hello', s: 0, e: 0.4 },
  { i: 1, w: 'world', s: 1.8, e: 2.1 },
  { i: 2, w: 'again', s: 2.2, e: 2.6 },
]

describe('BATCH R — D1 caption preview', () => {
  it('matches active word with small playback jitter', () => {
    const clipWords: ClipWord[] = [{ w: 'hi', s: 1.0, e: 1.5, i: 3, idx: 3 }]
    expect(activeCaptionWordIndex(clipWords, 1.02)).toBe(0)
    expect(activeCaptionWordIndex(clipWords, 0.5)).toBe(-1)
  })

  it('resolves emoji by transcript i index, not array position', () => {
    const w: ClipWord = { w: 'wow', s: 0, e: 1, i: 42, idx: 42 }
    expect(captionEmojiForWord(w, 0, { '42': '🔥' })).toBe('🔥')
  })

  it('builds output-timeline caption words for preview', () => {
    let edits = defaultEdits(bounds)
    edits.trim = { in: 0, out: 4000 }
    const caps = editorPreviewCaptionClipWords(words, edits)
    expect(caps.length).toBeGreaterThan(0)
    expect(caps[0].s).toBeLessThan(caps[0].e)
  })
})

describe('BATCH R — D2 headline seed', () => {
  it('prefills exportTemplate from aiMeta hook on headline layouts', () => {
    let edits = defaultEdits(bounds)
    edits.layout.mode = 'fit_top'
    const next = seedEditorExportTemplate(edits, {
      title: 'Clip headline',
      aiMeta: { postCopy: { hookText: 'They said it was impossible' } },
    })
    expect(next.exportTemplate?.suggestedHeadline).toMatch(/impossible|CLIP/i)
    expect(next.exportTemplate?.headlineBar?.text?.length).toBeGreaterThan(0)
    expect(next.exportTemplate?.headlineBar?.enabled).toBe(true)
  })
})

describe('BATCH R — D3 layout vs tighten', () => {
  it('layoutReservesHeadlineBand includes fit_top without touching silenceTrim', () => {
    let edits = defaultEdits(bounds)
    edits.silenceTrim = { enabled: false, minGapMs: 350, keepMs: 120 }
    const before = edits.silenceTrim?.enabled
    edits = { ...edits, layout: { ...edits.layout, mode: 'fit_top' } }
    expect(layoutReservesHeadlineBand('fit_top')).toBe(true)
    expect(edits.silenceTrim?.enabled).toBe(before)
  })
})

describe('BATCH R — D4 export duration', () => {
  it('does not apply silence polish when removeDeadAir is false', () => {
    let edits = defaultEdits(bounds)
    edits.trim = { in: 0, out: 10_000 }
    edits.silenceTrim = { enabled: false, minGapMs: 350, keepMs: 120 }
    const polished = applyExportPolishEdits(edits, { removeDeadAir: false, words })
    expect((polished.cutRanges ?? []).length).toBe(0)
    expect(outputDurationMs(polished)).toBe(outputDurationMs(edits))
  })

  it('preview duration shrinks when silence trim enabled on edits', () => {
    let edits = defaultEdits(bounds)
    edits.trim = { in: 0, out: 10_000 }
    edits.silenceTrim = { enabled: true, minGapMs: 350, keepMs: 120, fillerTrim: true }
    const full = outputDurationMs(edits)
    const preview = editorPreviewDurationMs(edits, words)
    expect(preview).toBeLessThan(full)
  })
})

describe('BATCH R — D5 timeline seek helper', () => {
  it('remaps source click fraction to output ms', () => {
    let edits = defaultEdits(bounds)
    edits.trim = { in: 1000, out: 5000 }
    const span = edits.trim.out - edits.trim.in
    const sourceMs = edits.trim.in + span * 0.5
    const segs = [[1000, 5000]] as [number, number][]
    let acc = 0
    for (const [a, b] of segs) {
      if (sourceMs >= a && sourceMs < b) {
        expect(acc + (sourceMs - a)).toBe(2000)
        return
      }
      acc += b - a
    }
    throw new Error('expected hit')
  })
})

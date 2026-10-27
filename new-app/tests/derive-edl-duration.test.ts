import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { deriveEdl } from '@/lib/clips/script-edl/derive-edl'
import { DEFAULT_EDL_PAD_MS } from '@/lib/clips/script-edl/derive-edl'
import {
  edlOutputVsSourceSpanMs,
  edlToTrimAndCutRanges,
  sumMergedSourceSpanMs,
} from '@/lib/clips/script-edl/edl-render-plan'
import { outputDurationMs } from '@/lib/clips/script-edl/edl-playback'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

const fixturePath = path.join(__dirname, 'fixtures', 'edl-dense-duration.json')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  padMs: number
  sourceDurationMs: number
  rangeStartMs: number
  rangeEndMs: number
  words: EditorWord[]
  document: ScriptDocumentV1
}

describe('deriveEdl duration (pad overlap)', () => {
  it('output duration equals merged source span + gaps, never exceeds source', () => {
    const byId = new Map(fixture.words.map((w) => [w.id, w]))
    const edl = deriveEdl(fixture.document, byId, { padMs: fixture.padMs })
    const { outputMs, sourceSpanMs, gapMs } = edlOutputVsSourceSpanMs(edl)
    expect(outputMs).toBeLessThanOrEqual(fixture.sourceDurationMs + gapMs + 100)
    expect(outputMs).toBe(sourceSpanMs + gapMs)
    expect(sumMergedSourceSpanMs(edl)).toBe(sourceSpanMs)
  })

  it('dense fixture without deletions is far below naive double-count', () => {
    const byId = new Map(fixture.words.map((w) => [w.id, w]))
    const edl = deriveEdl(fixture.document, byId, { padMs: DEFAULT_EDL_PAD_MS })
    const out = outputDurationMs(edl)
    const naive = fixture.words.length * (200 + DEFAULT_EDL_PAD_MS * 2)
    expect(out).toBeLessThan(naive * 0.85)
  })

  it('edlToTrimAndCutRanges removes silences between distant clusters', () => {
    const byId = new Map(fixture.words.map((w) => [w.id, w]))
    const sparse: ScriptDocumentV1 = {
      ...fixture.document,
      keptWordIds: ['m:0', 'm:9'],
      deletedWordIds: ['m:1', 'm:2', 'm:3', 'm:4', 'm:5', 'm:6', 'm:7', 'm:8'],
      wordOrder: fixture.document.wordOrder,
    }
    const edl = deriveEdl(sparse, byId, { padMs: fixture.padMs })
    const plan = edlToTrimAndCutRanges(edl, fixture.rangeStartMs, fixture.rangeEndMs)
    expect(plan.cutRanges.length).toBeGreaterThan(0)
    const cutTotal = plan.cutRanges.reduce((n, [a, b]) => n + (b - a), 0)
    expect(cutTotal).toBeGreaterThan(1000)
  })
})

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  captionChunkFit,
  captionFitConfigForEdits,
  captionSafeWidthPct,
  chunkCaptionWords,
  fitCaptionLine,
  roundHalfUp,
  textWidthPx,
} from '@/lib/clips/caption-fit'
import type { ExportAspect } from '@/lib/clips/export-aspect'

/**
 * E3fix2: preview ↔ export caption line-break parity. The fixture is generated from the export's
 * real ASS (build_ass at 720p and 1080p) by worker/tests/test_caption_fit_parity.py.
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/caption_fit_parity.json')
const WORKER_METRICS = path.resolve(here, '../../worker/clips_worker/caption_font_metrics.json')
const WEB_METRICS = path.resolve(here, '../lib/clips/caption-fit-metrics.json')

type Case = {
  id: string
  aspect: ExportAspect
  text: string
  captions: Record<string, unknown> & { emphasis?: number[] }
  expected: { n: number; breaks: number[]; pct: number }[]
}
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { cases: Case[] }

describe('E3fix2 caption fit parity (TS ↔ worker export ASS)', () => {
  it('metrics table is byte-identical to the worker copy', () => {
    expect(readFileSync(WEB_METRICS, 'utf8')).toBe(readFileSync(WORKER_METRICS, 'utf8'))
  })

  it.each(fixture.cases.map((c) => [c.id, c] as const))('%s: same chunks, breaks and shrink', (_id, c) => {
    const cfg = captionFitConfigForEdits(c.captions as never, true, c.aspect)
    const words = c.text.split(/\s+/).map((w, i) => ({ w, i }))
    const emphasis = new Set(c.captions.emphasis ?? [])
    const got = chunkCaptionWords(words, cfg.wordsPerLine).map((chunk) => {
      const f = captionChunkFit(cfg, chunk, emphasis)
      return { n: chunk.length, breaks: f.breaks, pct: f.scale < 0.999 ? roundHalfUp(100 * f.scale) : 100 }
    })
    expect(got).toEqual(c.expected)
  })

  it('the live repro line avoids a one-word orphan (Q3.1)', () => {
    const f = fitCaptionLine(['Energy,', 'capital,', 'whatever'], {
      font: 'Montserrat Black',
      fontsize: 125,
      maxWidthPx: 972,
      peakScale: 1.12,
      padPx: 8,
    })
    if (f.breaks.length) {
      expect(3 - f.breaks[f.breaks.length - 1]!).toBeGreaterThan(1)
      expect(f.breaks[0]!).toBeGreaterThan(1)
    }
    expect(textWidthPx('Energy, capital, whatever', 'Montserrat Black', 125)).toBeGreaterThan(1080)
    expect(captionSafeWidthPct('9:16')).toBeCloseTo(90, 5)
  })
})

import { describe, expect, it } from 'vitest'
import {
  refineCutBoundary,
  syntheticFillerAudio,
} from '@/lib/clips/cuts-quality/cut-boundary-refine'
import {
  isDefaultRemovableFiller,
  isMeaningfulLeadIn,
  isNonFillerPhrase,
} from '@/lib/clips/cuts-quality/filler-classifier'
import { pauseMiddleRemovalRange } from '@/lib/clips/cuts-quality/pause-shorten'
import { gapHitIsRmsQuiet } from '@/lib/clips/gap-audio-trim'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

describe('CUTS_QUALITY1 unit', () => {
  it('boundary refinement marks touching neighbor as needs_review', () => {
    const frames = syntheticFillerAudio({
      prevEndMs: 1000,
      fillerStartMs: 1020,
      fillerEndMs: 1080,
      nextStartMs: 1090,
      fillerTouchesNext: true,
    })
    const { meta } = refineCutBoundary({
      frames,
      reason: 'filler',
      neighbors: {
        prevEndMs: 1000,
        wordStartMs: 1020,
        wordEndMs: 1080,
        nextStartMs: 1090,
      },
    })
    expect(meta.confidence).toBe('needs_review')
  })

  it('pause middle removal keeps both speech edges', () => {
    const cut = pauseMiddleRemovalRange(0, 2000, 2000, 350)
    expect(cut).not.toBeNull()
    if (!cut) return
    expect(cut[0]).toBeGreaterThanOrEqual(120)
    expect(2000 - cut[1]).toBeGreaterThanOrEqual(120)
  })

  it('gap with sustained loud RMS is not quiet', () => {
    const samples: { tMs: number; rms: number }[] = []
    for (let t = 0; t <= 1000; t += 25) {
      samples.push({ tMs: t, rms: t >= 200 && t <= 800 ? 0.45 : 0.02 })
    }
    expect(gapHitIsRmsQuiet(0, 1000, samples)).toBe(false)
  })

  it('filler classifier keeps uh-huh and meaningful ah', () => {
    expect(isNonFillerPhrase('uh-huh')).toBe(true)
    const ah: EditorWord = {
      id: '1',
      text: 'Ah,',
      t0Ms: 0,
      t1Ms: 200,
      isFiller: true,
      fillerKind: 'lexicon',
    }
    const next: EditorWord = {
      id: '2',
      text: 'now',
      t0Ms: 210,
      t1Ms: 400,
      isFiller: false,
    }
    expect(isMeaningfulLeadIn(ah, next, new Set())).toBe(true)
    expect(isDefaultRemovableFiller(ah, [ah, next], 0, new Set())).toBe(false)
  })
})

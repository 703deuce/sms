import { describe, expect, it } from 'vitest'
import { buildCaptionWords, captionWordsToClipWords } from '@/lib/clips/caption-words'
import { applyClipPolishToEdits } from '@/lib/clips/clip-polish'
import { applySilenceTrimToEdits } from '@/lib/clips/silence-trim'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { buildZoomKeyframes } from '@/lib/clips/zoom-keyframes'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 0, clipEndMs: 4000 }

const fixtureWords: SourceWord[] = [
  { w: 'Hello', s: 0, e: 0.4, i: 0 },
  { w: 'um', s: 0.5, e: 0.7, i: 1 },
  { w: 'world', s: 1.8, e: 2.1, i: 2 },
  { w: 'secret', s: 2.2, e: 2.6, i: 3 },
  { w: 'works.', s: 2.6, e: 3.0, i: 4 },
]

function polishedEdits(): ClipEditsV2 {
  let edits = defaultEdits(bounds)
  edits = applyClipPolishToEdits(edits, {
    words: fixtureWords,
    hookText: 'She called him out',
    applySilenceCuts: true,
  })
  edits = applySilenceTrimToEdits(edits, fixtureWords, edits.silenceTrim)
  return edits
}

describe('polish render caption sync', () => {
  it('captions stay monotonic after silence trim + keyword emphasis', () => {
    const edits = polishedEdits()
    expect((edits.cutRanges ?? []).length).toBeGreaterThan(0)
    const caps = buildCaptionWords(fixtureWords, edits)
    expect(caps.length).toBeGreaterThan(0)
    expect(caps.map((c) => c.text)).not.toContain('um')
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i].s_ms).toBeGreaterThanOrEqual(caps[i - 1].s_ms)
    }
    const renderWords = captionWordsToClipWords(caps)
    const durationS = caps[caps.length - 1].e_ms / 1000
    const emph = edits.captions?.emphasis ?? []
    const kf = buildZoomKeyframes(renderWords, emph, durationS, edits.zoom?.intensity)
    expect(kf.some((k) => k.z > 1)).toBe(true)
  })
})

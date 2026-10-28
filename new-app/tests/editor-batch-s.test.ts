import { describe, expect, it } from 'vitest'
import {
  keepSegments,
  sanitizeCutRangesForTrim,
  type ClipBounds,
} from '@/lib/clips/edits'
import {
  protectedContentSpansFromAiMeta,
  silenceTrimCutRanges,
  SILENCE_TRIM_NATURAL,
} from '@/lib/clips/silence-trim'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'
import { seedEditorExportTemplate } from '@/lib/clips/editor-export-template-seed'
import { defaultEdits } from '@/lib/clips/edits'

describe('batch S — keepSegments / sanitize cuts', () => {
  const bounds: ClipBounds = { clipStartMs: 170_000, clipEndMs: 172_000 }
  const trimIn = 170_000
  const trimOut = 171_800

  it('drops cuts entirely outside trim and avoids segment past trimOut', () => {
    const cuts = sanitizeCutRangesForTrim([[171_825, 172_080]], trimIn, trimOut)
    expect(cuts).toEqual([])
    const segs = keepSegments(trimIn, trimOut, [[171_825, 172_080]])
    expect(segs).toEqual([[trimIn, trimOut]])
    const dur = segs.reduce((s, [a, b]) => s + (b - a), 0)
    expect(dur).toBe(1800)
  })
})

describe('batch S — silence trim selective', () => {
  it('skips gaps larger than maxPlausibleGapMsForTrim', () => {
    const trimIn = 140_235
    const trimOut = 161_865
    const words = [
      { s: 140.24, e: 140.5 },
      { s: 160.0, e: 160.2 },
    ]
    const cuts = silenceTrimCutRanges(words, SILENCE_TRIM_NATURAL, {
      trimIn,
      trimOut,
      protectedSpans: protectedContentSpansFromAiMeta({
        boundary_setup_ms: 140_235,
        boundary_payoff_ms: 161_865,
      }),
    })
    expect(cuts).toEqual([])
  })
})

describe('batch S — settings captions optional', () => {
  it('parses payload without captions key', () => {
    const parsed = clipProjectSettingsSchema.parse({
      v: 2,
      mode: 'auto',
      genre: 'auto',
      clipLength: 'auto',
      clipLenMode: 'auto',
      targetClipLenS: null,
      rangeStartMs: 0,
      rangeEndMs: 0,
      layout: 'speaker_follow',
      aspectRatio: '9:16',
    })
    expect(parsed.captions.enabled).toBe(true)
    expect(parsed.captions.presetId).toBe('bold_pop')
  })
})

describe('batch S — headline seed', () => {
  it('uses clip title not pass1_why', () => {
    const bounds: ClipBounds = { clipStartMs: 0, clipEndMs: 60_000 }
    const edits = defaultEdits(bounds)
    const next = seedEditorExportTemplate(
      { ...edits, layout: { ...edits.layout, mode: 'full_frame' } },
      {
        title: 'Apex clutch win',
        aiMeta: { pass1_why: 'The laugh at s12 may mark excitement', hook: 'CLUTCH' },
      },
    )
    expect(next.exportTemplate?.suggestedHeadline).toMatch(/Apex|CLUTCH/i)
    expect(next.exportTemplate?.suggestedHeadline).not.toMatch(/laugh at s/i)
  })
})

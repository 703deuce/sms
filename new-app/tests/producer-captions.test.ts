import { describe, expect, it } from 'vitest'
import {
  captionStylesEqual,
  normalizeCaptionPresetId,
  sanitizeProducerCaptionReply,
} from '@/lib/clips/producer-captions'
import { defaultEdits } from '@/lib/clips/edits'
import { applyProducerTools } from '@/lib/clips/edits-reducer'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('producer captions noop', () => {
  it('treats bold pop + pop as unchanged', () => {
    const base = defaultEdits(bounds)
    const { edits, summaries } = applyProducerTools(base, bounds, [
      { name: 'set_captions', args: { presetId: 'bold_pop', animation: 'pop' } },
    ])
    expect(summaries[0]).toBe('No caption change needed')
    expect(captionStylesEqual(base, edits)).toBe(true)
  })

  it('normalizes human preset names', () => {
    expect(normalizeCaptionPresetId('Bold Pop')).toBe('bold_pop')
    expect(normalizeCaptionPresetId('bold-pop')).toBe('bold_pop')
  })

  it('rewrites false caption change claims in reply', () => {
    const base = defaultEdits(bounds)
    const reply = sanitizeProducerCaptionReply(
      'I updated the captions to bold, pop-animated style.',
      base,
      base,
      true,
    )
    expect(reply).toContain('no change was needed')
  })
})

import { describe, it, expect } from 'vitest'
import { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import { validateDraft, WORD_GUARD_MS } from '@/lib/ai-producer-agent/validate'
import type { ClipWord } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }
const words: ClipWord[] = [{ w: 'hello', s: 5.0, e: 5.5 }]

describe('validateDraft items', () => {
  it('flags cut_in_word', () => {
    const b = new DraftEditsBuilder(bounds, 'src', words, () => [{ tMs: 5000, rms: 0.01 }])
    b.addSegment({ sourceId: 'src', srcInMs: 0, srcOutMs: 5050, beat: 'payoff' })
    const rep = validateDraft(b, {
      words,
      laughs: [],
      reactions: [],
      bursts: [],
      layoutAt: () => null,
      outputType: 'single_payoff',
      targetLengthS: [15, 30],
      memeSfx: 'off',
      payoffSrc: [[0, 5050]],
    })
    expect(rep.hardFailures.some((h) => h.code === 'cut_in_word')).toBe(true)
    expect(WORD_GUARD_MS).toBe(30)
  })
})

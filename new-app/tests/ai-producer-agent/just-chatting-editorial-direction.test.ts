import { describe, expect, it } from 'vitest'
import { buildJustChattingEvidence } from '@/lib/ai-producer-agent/just-chatting-evidence'
import {
  JUST_CHATTING_DIRECTION_VERSION, JUST_CHATTING_EDITORIAL_DIRECTION,
  JUST_CHATTING_ROLE_DIRECTION, JUST_CHATTING_REVIEW_CHECKS,
} from '@/lib/ai-producer-agent/just-chatting-direction'

describe('Just Chatting editorial direction from five case studies', () => {
  it('teaches specialists what belongs in a conversational full edit', () => {
    expect(JUST_CHATTING_DIRECTION_VERSION).toBe('jc-editorial-v1')
    for (const rule of ['chronological', 'repetition', 'laughter', 'caption', 'music', 'source', 'viewer']) {
      expect(JUST_CHATTING_EDITORIAL_DIRECTION.toLowerCase()).toContain(rule)
    }
    expect(JUST_CHATTING_ROLE_DIRECTION.story).toContain('payoff')
    expect(JUST_CHATTING_ROLE_DIRECTION.footage).toContain('redundant')
    expect(JUST_CHATTING_ROLE_DIRECTION.dialogue).toContain('phonemes')
    expect(JUST_CHATTING_ROLE_DIRECTION.assembly).toContain('restrained')
    expect(JUST_CHATTING_ROLE_DIRECTION.qa).toContain('context')
    expect(JUST_CHATTING_REVIEW_CHECKS).toContain('reaction_integrity')
    expect(JUST_CHATTING_REVIEW_CHECKS).toContain('audio_continuity')
  })

  it('provides the supervising editor actual source dialogue around cuts', () => {
    const words = [
      { w: 'Here', s: 0.1, e: 0.4 }, { w: 'is', s: 0.5, e: 0.7 },
      { w: 'the', s: 0.8, e: 1 }, { w: 'setup', s: 1.1, e: 1.5 },
      { w: 'laugh', s: 9.2, e: 9.5 }, { w: 'from', s: 10.0, e: 10.3 },
      { w: 'another', s: 12.0, e: 12.4 }, { w: 'topic', s: 13.0, e: 13.3 },
      { w: 'new', s: 20.1, e: 20.4 }, { w: 'story', s: 21.0, e: 21.5 },
      { w: 'the', s: 32.0, e: 32.2 }, { w: 'payoff', s: 33.0, e: 33.4 },
    ]
    const output = buildJustChattingEvidence(words, [0, 40_000], [
      { startMs: 0, endMs: 10_000, beat: 'setup', reason: 'necessary context' },
      { startMs: 20_000, endMs: 35_000, beat: 'payoff', reason: 'resolved story' },
    ])
    expect(output.keptSeconds).toBe(25)
    expect(output.removedSeconds).toBe(15)
    expect(output.selections).toHaveLength(2)
    expect(output.selections[0].openingWords).toContain('Here is the setup')
    expect(output.selections[1].closingWords).toContain('the payoff')
    expect(output.joins).toHaveLength(1)
    expect(output.joins[0]).toMatchObject({
      fromIndex: 0, toIndex: 1, removedMs: 10_000,
      needsListeningReview: true,
    })
    expect(output.joins[0].before).toContain('laugh')
    expect(output.joins[0].after).toContain('new story')
  })

  it('preserves source absolute timestamps instead of inventing a zero-based cut', () => {
    const output = buildJustChattingEvidence([
      { w: 'hello', s: 3660.1, e: 3660.7 },
      { w: 'there', s: 3661, e: 3661.4 },
    ], [3_600_000, 3_680_000], [
      { startMs: 3_660_000, endMs: 3_665_000, beat: 'opening', reason: 'start' },
    ])
    expect(output.selections[0].sourceMs).toEqual([3_660_000, 3_665_000])
    expect(output.selections[0].openingWords).toBe('hello there')
  })
})

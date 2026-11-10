import { describe, expect, it } from 'vitest'
import { rankSavedUnifiedClips } from '@/lib/ai-producer-agent/clip-mode/unified-recovery'

const timestamp = new Date('2026-11-10T06:00:00Z')
function clip(id: string, type: 'story' | 'continuous', score: number, startMs: number, endMs: number) {
  return {
    id, score, startMs, endMs, editsSaveVersion: 1, updatedAt: timestamp,
    aiMeta: { aiProducerRunId: 'aprun_1', type },
  }
}

describe('unified run watchdog recovery ranking', () => {
  it('ranks story and continuous clips together without repeating the full picker', () => {
    const ranked = rankSavedUnifiedClips([
      clip('story_1', 'story', 94, 0, 60000),
      clip('story_2', 'story', 89, 110000, 170000),
      clip('continuous_1', 'continuous', 91, 250000, 290000),
      clip('continuous_2', 'continuous', 80, 360000, 390000),
    ])
    expect(ranked.kept.map((c) => c.id)).toEqual(['story_1', 'continuous_1', 'story_2'])
    expect(ranked.mix).toEqual({ story: 2, continuous: 1, droppedDuplicates: 0 })
  })

  it('deduplicates overlapping saved Story clips by existing score and retains source ranges', () => {
    const ranked = rankSavedUnifiedClips([
      clip('story_low', 'story', 70, 0, 60000),
      clip('story_high', 'story', 95, 5000, 61000),
      clip('story_far', 'story', 88, 120000, 180000),
    ])
    expect(ranked.kept.map((c) => c.id)).toEqual(['story_high', 'story_far'])
    expect(ranked.droppedDuplicates).toHaveLength(1)
    expect(ranked.droppedDuplicates[0]?.droppedId).toBe('story_low')
  })

  it('keeps a usable saved edit with zero score but rejects an unedited draft', () => {
    const editable = clip('saved', 'story', 0, 0, 60000)
    const pending = { ...clip('unfinished', 'continuous', 0, 90000, 120000), editsSaveVersion: 0 }
    const ranked = rankSavedUnifiedClips([editable, pending])
    expect(ranked.kept.map((c) => c.id)).toEqual(['saved'])
  })

  it('preserves continuous-only results when Story generation was interrupted', () => {
    const ranked = rankSavedUnifiedClips([clip('moment_1', 'continuous', 85, 0, 30000)])
    expect(ranked.kept.map((c) => c.id)).toEqual(['moment_1'])
  })
})

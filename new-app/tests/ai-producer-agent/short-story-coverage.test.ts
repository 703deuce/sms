import { describe, expect, it } from 'vitest'
import { shortStoryCoverage } from '@/lib/ai-producer-agent/specialists'
import type { ClipWord } from '@/lib/clips/edits'

const select = (startMs: number, endMs: number) => ({
  startMs, endMs, beat: 'story', reason: 'source-backed dialogue',
})
const words: ClipWord[] = [
  { w: 'And', s: 364.9, e: 365.1 },
  { w: 'I', s: 365.2, e: 365.4 },
  { w: 'just...', s: 365.6, e: 366.3 },
  { w: 'finished.', s: 1020.0, e: 1020.3 },
]
describe('short-form narrative coverage', () => {
  it('detects the actual 65-second near-contiguous interview excerpt as needing a story revision', () => {
    const coverage = shortStoryCoverage([
      select(300675, 322175), select(322195, 338070), select(338890, 366640),
    ], words, [75, 105], [300040, 1500040])
    expect(coverage.durationSeconds).toBeCloseTo(65.125, 2)
    expect(coverage.localOnly).toBe(true)
    expect(coverage.needsReview).toBe(true)
    expect(coverage.terminalSentence).toBe(false)
  })
  it('recognizes sourced passages across a longer interview with a completed ending', () => {
    const coverage = shortStoryCoverage([
      select(300675, 323795), select(700000, 727000), select(1000000, 1020300),
    ], words, [75, 105], [300040, 1500040])
    expect(coverage.localOnly).toBe(false)
    expect(coverage.terminalSentence).toBe(true)
  })
  it('does not impose distant cuts on a source too short to contain distant moments', () => {
    const coverage = shortStoryCoverage([
      select(0, 50000), select(50020, 90000),
    ], [{ w: 'Done.', s: 89.7, e: 89.9 }], [75, 105], [0, 95000])
    expect(coverage.localOnly).toBe(false)
    expect(coverage.terminalSentence).toBe(true)
    expect(coverage.needsReview).toBe(false)
  })
})

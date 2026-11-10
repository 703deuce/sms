import { describe, expect, it } from 'vitest'
import { excludeLockedProposals, fillerProposals, gapProposals, retakeProposals } from '../lib/clips/editor/cleanup-proposals'
import type { CleanupProposal } from '../lib/clips/editor/cleanup-proposals'
import type { RetakeGroup } from '../lib/clips/editor/retakes'
import type { EditorWord } from '../lib/clips/script-editor/to-editor-words'

describe('locked ranges on cleanup proposals', () => {
  it('filters filler, gap, and retake proposals that overlap locked intro/outro', () => {
    const words: EditorWord[] = [
      { id: 'w0', text: 'hello', t0Ms: 0, t1Ms: 400, isFiller: false } as EditorWord,
      { id: 'w1', text: 'there', t0Ms: 5000, t1Ms: 5600, isFiller: false } as EditorWord,
    ]
    const gaps = gapProposals(words, [], {
      mode: 'more_than',
      minGapMs: 600,
      targetGapMs: 250,
      // no rms: allows transcript-middle fallback
    })
    const locked = [[0, 2000]] as [number, number][]
    const open = excludeLockedProposals(gaps, locked)
    expect(open.every((row: CleanupProposal) => row.range[1] <= 0 || row.range[0] >= 2000 || row.range[0] >= 2000)).toBe(true)
    expect(open.every((row: CleanupProposal) => row.range[1] <= locked[0]![0] || row.range[0] >= locked[0]![1])).toBe(true)

    const groups = [
      {
        keepIndex: 1,
        attempts: [
          { startMs: 500, endMs: 1500, text: 'I was going to say' },
          { startMs: 1600, endMs: 2800, text: 'I was going to say hello' },
        ],
      },
    ] as unknown as RetakeGroup[]
    const retakes = retakeProposals(groups, [], { lockedRanges: locked })
    expect(retakes).toHaveLength(0)
    const unlocked = retakeProposals(groups, [])
    expect(unlocked.length).toBeGreaterThan(0)

    const fillers = fillerProposals(
      [{ id: 'f', text: 'um', t0Ms: 800, t1Ms: 1000, isFiller: true, fillerKind: 'lexicon' } as EditorWord],
      new Set(),
      { strength: 'light', lockedRanges: locked },
    )
    expect(fillers).toHaveLength(0)
  })

  it('leaves proposals outside the lock untouched', () => {
    const rows: CleanupProposal[] = [
      { id: 'a', kind: 'filler', range: [8000, 8200], label: 'um' },
      { id: 'b', kind: 'gap', range: [100, 900], label: 'pause' },
    ]
    const kept = excludeLockedProposals(rows, [[0, 3000]])
    expect(kept.map((row: CleanupProposal) => row.id)).toEqual(['a'])
  })
})

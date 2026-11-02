import { describe, expect, it } from 'vitest'
import {
  mergeCleanupCutRanges,
  mergeCutCleanupKindsForRanges,
  proposalId,
  reconcileCutCleanupKinds,
} from '@/lib/clips/editor/cleanup-proposals'

describe('reconcileCutCleanupKinds after merge', () => {
  it('keeps filler kind when adjacent filler cuts merge into one range', () => {
    const prevCuts: [number, number][] = []
    const proposals: [number, number][] = [
      [14_000, 14_400],
      [14_350, 14_800],
    ]
    const merged = mergeCleanupCutRanges(prevCuts, proposals, [])
    expect(merged).toHaveLength(1)
    const mergedId = proposalId(merged[0]!)
    const tagged = mergeCutCleanupKindsForRanges(undefined, proposals, ['filler', 'filler'])
    const kinds = reconcileCutCleanupKinds(
      tagged,
      prevCuts,
      merged,
      proposals.map((range, i) => ({ range, kind: 'filler' as const })),
    )
    expect(kinds?.[mergedId]).toBe('filler')
  })

  it('preserves repeat over manual when a merged cut spans both', () => {
    const prev: [number, number][] = [[18_000, 18_500]]
    const meta = { [proposalId(prev[0]!)]: 'repeat' as const }
    const add: [number, number][] = [[18_400, 19_000]]
    const merged = mergeCleanupCutRanges(prev, add, [])
    const tagged = mergeCutCleanupKindsForRanges(meta, add, ['filler'])
    const kinds = reconcileCutCleanupKinds(
      tagged,
      prev,
      merged,
      [{ range: add[0]!, kind: 'filler' }],
    )
    const id = proposalId(merged[0]!)
    expect(kinds?.[id]).toBe('repeat')
  })
})

import { describe, expect, it } from 'vitest'
import { applyProposalsToEdits, clarityProposals, type CleanupProposal } from '@/lib/clips/editor/cleanup-proposals'
import { defaultEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 10_000, trimMinMs: 0, trimMaxMs: 10_000 }

describe('clarityProposals', () => {
  it('labels clarity cuts', () => {
    const props = clarityProposals([{ range: [100, 200], reason: 'filler' }])
    expect(props[0]?.kind).toBe('clarity')
    expect(props[0]?.label).toBe('Clarity · filler')
  })

  it('merges with existing filler cuts', () => {
    const edits = defaultEdits(bounds)
    const filler: CleanupProposal = {
      id: '0:50',
      kind: 'filler',
      range: [0, 50],
      label: 'um',
    }
    const clarity = clarityProposals([{ range: [200, 300], reason: 'ramble' }])
    const next = applyProposalsToEdits(edits, [filler, ...clarity], [])
    expect(next.cutRanges?.length).toBeGreaterThanOrEqual(2)
  })
})

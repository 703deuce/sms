import { describe, expect, it } from 'vitest'
import {
  applyProposalsToEdits,
  fillerProposals,
  restoreCleanupProposal,
  retakeProposals,
} from '@/lib/clips/editor/cleanup-proposals'
import { defaultEdits } from '@/lib/clips/edits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import type { RetakeGroup } from '@/lib/clips/editor/retakes'

const words: EditorWord[] = [
  { id: 'w0', text: 'um', t0Ms: 1000, t1Ms: 1200, isFiller: true } as EditorWord,
  { id: 'w1', text: 'hello', t0Ms: 2000, t1Ms: 2400, isFiller: false } as EditorWord,
]

describe('retake cleanup proposals', () => {
  it('labels retake proposals', () => {
    const groups: RetakeGroup[] = [
      {
        attempts: [
          { startMs: 1000, endMs: 2000, text: 'one two three four five six seven' },
          { startMs: 4000, endMs: 5000, text: 'one two three four five six seven' },
        ],
        keepIndex: 1,
      },
    ]
    const props = retakeProposals(groups)
    expect(props[0]?.kind).toBe('retake')
    expect(props[0]?.label).toMatch(/^Retake · "/)
    expect(props[0]?.label).toContain('…')
  })

  it('apply and restore round-trip', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
    const edits = defaultEdits(bounds)
    const props = retakeProposals([
      {
        attempts: [
          { startMs: 1000, endMs: 2000, text: 'a b c' },
          { startMs: 3000, endMs: 4000, text: 'a b c d' },
        ],
        keepIndex: 1,
      },
    ])
    const next = applyProposalsToEdits(edits, props, [])
    expect(next.cutRanges).toEqual([[1000, 3000]])
    const restored = restoreCleanupProposal(next, props[0]!.range)
    expect(restored.cutRanges).toEqual([])
  })

  it('does not change filler proposals', () => {
    const props = fillerProposals(words, new Set())
    expect(props[0]?.kind).toBe('filler')
  })
})

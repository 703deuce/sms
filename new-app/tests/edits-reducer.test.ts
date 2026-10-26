import { describe, expect, it } from 'vitest'
import { applyProducerTool } from '@/lib/clips/edits-reducer'
import { defaultEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('edits-reducer', () => {
  it('trims clip range', () => {
    const base = defaultEdits(bounds)
    const { edits, summary } = applyProducerTool(base, bounds, {
      name: 'trim',
      args: { inMs: 1000, outMs: 20_000 },
    })
    expect(edits.trim.in).toBe(1000)
    expect(edits.trim.out).toBe(20_000)
    expect(summary).toContain('Trimmed')
  })

  it('flags paid tools as pending', () => {
    const base = defaultEdits(bounds)
    const res = applyProducerTool(base, bounds, {
      name: 'generate_music',
      args: { prompt: 'lofi' },
    })
    expect(res.pendingPaid?.name).toBe('generate_music')
  })
})

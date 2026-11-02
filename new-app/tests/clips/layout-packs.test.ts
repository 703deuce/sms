import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import { applyLayoutPack, layoutPackCreateSchema, layoutPackFromEdits } from '@/lib/clips/layout-packs'

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }

describe('layout packs', () => {
  it('round-trips layout and caption style without touching words', () => {
    const base = defaultEdits(bounds)
    const words = [{ w: 'hi', s: 0, e: 1 }]
    const edits = {
      ...base,
      words,
      layout: { ...base.layout, mode: 'split' as const, userPicked: true },
      captions: { ...base.captions, presetId: 'clean_white', animation: 'none' },
    }
    const pack = layoutPackFromEdits(edits, '9:16')
    const out = applyLayoutPack(defaultEdits(bounds), pack)
    expect(out.layout).toEqual(edits.layout)
    expect(out.captions?.presetId).toBe('clean_white')
    expect(out.words).not.toBe(words)
    expect(defaultEdits(bounds).words).toEqual(base.words)
  })

  it('layoutPackCreateSchema rejects bad input', () => {
    expect(() => layoutPackCreateSchema.parse({ name: '', payload: { v: 1, aspect: '9:16', layout: {} } })).toThrow()
    expect(() =>
      layoutPackCreateSchema.parse({ name: 'ok', payload: { v: 1, aspect: '3:2', layout: {} } }),
    ).toThrow()
  })
})

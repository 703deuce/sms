import { describe, expect, it } from 'vitest'
import { mergeEditsThreeWay } from '@/lib/clips/edits-merge'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

describe('mergeEditsThreeWay worker-owned fields', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

  it('keeps local caption change and server music change', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const local = normalizeEdits(
      {
        ...base,
        captions: { ...base.captions, presetId: 'clean_white' },
      },
      bounds,
    )
    const server = normalizeEdits(
      {
        ...base,
        audio: {
          music: {
            generationId: 'srv-music-gen',
            volume: 0.42,
          },
          sfx: [],
        },
      },
      bounds,
    )
    const { merged } = mergeEditsThreeWay(base, local, server, bounds)
    expect(merged.captions?.presetId).toBe('clean_white')
    expect(merged.audio?.music?.volume).toBe(0.42)
  })
})

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

  it('T6.2: both diverged on captions merges local presetId with server words', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const local = normalizeEdits(
      {
        ...base,
        captions: { ...base.captions, presetId: 'cp11' },
      },
      bounds,
    )
    const server = normalizeEdits(
      {
        ...base,
        captions: { ...base.captions, case: 'upper' },
      },
      bounds,
    )
    const { merged } = mergeEditsThreeWay(base, local, server, bounds)
    expect(merged.captions?.presetId).toBe('cp11')
    expect(merged.captions?.case).toBe('upper')
  })

  it('T6.2: both diverged on audio keeps server audio', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const local = normalizeEdits(
      {
        ...base,
        audio: { music: { generationId: 'local', volume: 0.1 }, sfx: [] },
      },
      bounds,
    )
    const server = normalizeEdits(
      {
        ...base,
        audio: { music: { generationId: 'server', volume: 0.9 }, sfx: [] },
      },
      bounds,
    )
    const { merged } = mergeEditsThreeWay(base, local, server, bounds)
    expect(merged.audio?.music?.generationId).toBe('server')
  })
})

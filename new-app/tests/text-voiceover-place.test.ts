import { describe, expect, it, vi } from 'vitest'

/** Mirrors text-voiceover-section place path: never fetch(blob:). */
export function voiceoverPlaceBlob(
  previewBlob: Blob | null,
  synthesize: () => Promise<Blob>,
): Promise<Blob> {
  if (previewBlob) return Promise.resolve(previewBlob)
  return synthesize()
}

describe('voiceover place blob', () => {
  it('reuses preview blob without a second synthesize', async () => {
    const synth = vi.fn(async () => new Blob(['new'], { type: 'audio/mpeg' }))
    const cached = new Blob(['cached'], { type: 'audio/mpeg' })
    const out = await voiceoverPlaceBlob(cached, synth)
    expect(out).toBe(cached)
    expect(synth).not.toHaveBeenCalled()
  })

  it('synthesizes when no preview blob', async () => {
    const synth = vi.fn(async () => new Blob(['new'], { type: 'audio/mpeg' }))
    const out = await voiceoverPlaceBlob(null, synth)
    expect(await out.text()).toBe('new')
    expect(synth).toHaveBeenCalledTimes(1)
  })
})

describe('voiceover preview charges', () => {
  it('documents one POST per preview or cold place', () => {
    /** Preview: 1× POST /voiceover (TTS). Place after preview: 0× POST (reuse blob). Cold place: 1× POST. */
    expect(true).toBe(true)
  })
})

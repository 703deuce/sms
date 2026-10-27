import { describe, expect, it } from 'vitest'
import { normalizeAudioEdits } from '@/lib/clips/audio'

describe('studio sound audio edits', () => {
  it('normalizes studioSound for worker export', () => {
    const audio = normalizeAudioEdits({
      music: null,
      sfx: [],
      studioSound: { enabled: true, generationId: 'gen_1', mix: 0.6 },
    })
    expect(audio.studioSound?.generationId).toBe('gen_1')
    expect(audio.studioSound?.enabled).toBe(true)
    expect(audio.studioSound?.mix).toBe(0.6)
  })
})

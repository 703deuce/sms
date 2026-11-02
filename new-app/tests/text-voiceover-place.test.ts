import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { addVoiceoverClip } from '@/lib/clips/editor/recording'
import { isVoiceoverTrackName } from '@/lib/clips/editor/recording'
import { effectiveTracks } from '@/lib/clips/editor/tracks'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

describe('text voiceover place', () => {
  it('addVoiceoverClip uses voiceover track and placement id not raw upl_', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const next = addVoiceoverClip(base, 'upl_abc', 0, 1600, () => 'id')
    const cue = next.audio?.sfx[0]
    expect(cue?.uploadId).toBe('upl_abc')
    expect(cue?.generationId).toBe('upl_abc')
    const tracks = effectiveTracks(next)
    const vo = tracks.find((t) => t.kind === 'audio' && isVoiceoverTrackName(t.name))
    expect(vo).toBeTruthy()
  })
})

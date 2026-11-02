import { describe, expect, it } from 'vitest'
import { inferShotsFromWords } from '@/lib/clips/crop-shots'
import { buildMulticamSegments, type ClipMediaSource } from '@/lib/clips/editor/sources'
import { speakersInTranscript } from '@/lib/clips/editor/transcript-speakers'
import type { SourceWord } from '@/lib/clips/source-words'

const ANGLE: ClipMediaSource = { id: 'cam2', ref: 'take', refId: 'cam2', mediaType: 'video', label: 'Cam 2' }

/** clip_5f19e510-style: Streamer (A) + guest (B) from crop shots, not word.spk alone. */
function clip5f19SpeakerFixture() {
  const words: SourceWord[] = []
  let i = 0
  let t = 0
  const push = (text: string, durS: number) => {
    words.push({ i: i++, w: text, s: t, e: t + durS, spk: 0 })
    t += durS + 0.05
  }
  for (let k = 0; k < 8; k++) push('stream', 0.35)
  t = 15
  for (let k = 0; k < 6; k++) {
    words.push({ i: i++, w: 'guest', s: t, e: t + 0.4, spk: 1 })
    t += 0.45
  }
  const trimIn = 0
  const trimOut = 25_000
  const shots = inferShotsFromWords(words, trimIn, trimOut)
  return { words, shots, trimIn, trimOut }
}

describe('multicam transcript speaker ids (clip_5f19e510)', () => {
  it('lists both A and B speakers like the Script panel', () => {
    const { words, shots, trimIn, trimOut } = clip5f19SpeakerFixture()
    const rows = speakersInTranscript(words, shots, trimIn, trimOut)
    expect(rows.map((r) => r.id).sort()).toEqual(['A', 'B'])
  })

  it('auto-switch with two mapped angles produces guest segments after min hold', () => {
    const { words, shots, trimIn, trimOut } = clip5f19SpeakerFixture()
    const mc = { speakerSources: { A: 'main', B: 'cam2' }, minHoldMs: 2000, wideEveryMs: 120_000 }
    const segs = buildMulticamSegments(words, trimIn, trimOut, mc, [ANGLE], shots)
    expect(segs.some((s) => s.sourceId === 'cam2' && s.auto)).toBe(true)
    expect(segs.every((s) => s.endMs - s.startMs >= 2000 || s.endMs - s.startMs >= 100)).toBe(true)
  })

  it('wide every 5s switches to a mapped alternate angle even during one-speaker spans', () => {
    const words: SourceWord[] = []
    let t = 0
    for (let k = 0; k < 40; k++) {
      words.push({ i: k, w: 'mono', s: t, e: t + 0.35, spk: 0 })
      t += 0.4
    }
    const shots = [{ startMs: 0, endMs: 20_000, speaker: 'A', cx: 30, cy: 45, w: 100, h: 100 }]
    const mc = { speakerSources: { A: 'main', B: 'cam2' }, minHoldMs: 2000, wideEveryMs: 5000 }
    const segs = buildMulticamSegments(words, 0, 20_000, mc, [ANGLE], shots)
    expect(segs.filter((s) => s.sourceId === 'cam2').length).toBeGreaterThanOrEqual(2)
  })
})

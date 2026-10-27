import { describe, expect, it } from 'vitest'
import { buildAutoMulticamScenes } from '@/lib/clips/script-editor/multicam-scenes'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

function w(id: string, spk: string, t0: number, t1: number): EditorWord {
  return {
    id,
    index: Number(id),
    t0Ms: t0,
    t1Ms: t1,
    text: 'hi',
    speakerId: spk,
  }
}

describe('buildAutoMulticamScenes', () => {
  it('emits scenes on speaker change after min hold', () => {
    const words = [
      w('0', 'spk:0', 0, 3000),
      w('1', 'spk:0', 3000, 6000),
      w('2', 'spk:1', 6500, 10_000),
    ]
    const scenes = buildAutoMulticamScenes(words, { minHoldMs: 2000, wideEveryMs: 60_000 })
    expect(scenes.length).toBeGreaterThanOrEqual(2)
    expect(scenes[0].layoutId).toContain('speaker')
  })
})

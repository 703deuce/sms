import { describe, expect, it } from 'vitest'
import { draftToComposition } from '@/lib/server/t2v/to-composition'
import type { T2vDraftV1 } from '@/lib/t2v/types'

const baseDraft: T2vDraftV1 = {
  v: 1,
  title: 'Test',
  source: { kind: 'prompt', prompt: 'hi' },
  settings: {
    aspect: '16:9',
    targetDurationS: 60,
    language: 'en',
    tone: 'friendly',
    sceneSplit: 'ai',
    mediaSources: ['pixabay'],
    mediaMix: 'video_first',
    captionsEnabled: true,
  },
  voice: null,
  music: null,
  scenes: [
    {
      id: 's1',
      slot: 0,
      narration: 'Hello world',
      keywords: [],
      visualQuery: 'sun',
      media: { provider: 'color', kind: 'color', color: '0' },
      padMs: 400,
      transition: 'cut',
      transitionMs: 500,
      texts: [],
    },
    {
      id: 's2',
      slot: 1,
      narration: 'Second scene',
      keywords: [],
      visualQuery: 'moon',
      media: { provider: 'color', kind: 'color', color: '0' },
      padMs: 400,
      transition: 'fade',
      transitionMs: 500,
      texts: [],
    },
  ],
  nextSlot: 2,
}

describe('draftToComposition', () => {
  it('preserves deletedWordIds from previous composition when ids still exist', () => {
    const words = [
      { w: 'Hello', s: 0, e: 0.5, i: 0 },
      { w: 'world', s: 0.5, e: 1, i: 1 },
      { w: 'Second', s: 2, e: 2.5, i: 10000 },
      { w: 'scene', s: 2.5, e: 3, i: 10001 },
    ]
    const sourceMediaId = 'clip_upload:upl_1'
    const doc = draftToComposition({
      draft: baseDraft,
      sourceMediaId,
      words,
      sceneStartsMs: { s1: 0, s2: 2000 },
      previous: {
        v: 1,
        keptWordIds: [],
        deletedWordIds: [`${sourceMediaId}:10000`],
      },
    })
    expect(doc.deletedWordIds).toContain(`${sourceMediaId}:10000`)
    expect(doc.keptWordIds).toContain(`${sourceMediaId}:0`)
    expect(doc.scenes?.[1]?.startWordId).toBe(`${sourceMediaId}:10000`)
  })
})

import { describe, expect, it } from 'vitest'
import { applyTemplateStyleToDraft } from '@/lib/server/t2v/template-apply'
import type { T2vDraftV1 } from '@/lib/t2v/types'

const baseDoc = (): T2vDraftV1 => ({
  v: 1,
  title: 'T',
  source: { kind: 'prompt', prompt: 'hello' },
  settings: {
    aspect: '16:9',
    targetDurationS: 60,
    language: 'en',
    tone: 'friendly',
    platform: 'youtube',
    sceneSplit: 'ai',
    mediaSources: ['pixabay'],
    mediaMix: 'video_first',
    captionsEnabled: true,
  },
  voice: undefined,
  music: { volume: 0.25, duck: true },
  scenes: [
    {
      id: 'sc_0',
      slot: 0,
      narration: 'Keep me',
      keywords: [],
      visualQuery: 'test',
      media: { provider: 'color', kind: 'color', color: '#111' },
      padMs: 0,
      transition: 'cut',
      transitionMs: 0,
      texts: [],
    },
  ],
  nextSlot: 1,
})

describe('applyTemplateStyleToDraft', () => {
  it('preserves scene narration', () => {
    const doc = baseDoc()
    const next = applyTemplateStyleToDraft(
      doc,
      {
        settings: { tone: 'calm', aspect: '9:16' },
        music: { volume: 0.1 },
        defaultTransitions: { transition: 'fade', transitionMs: 400 },
      },
      'tmpl_x',
    )
    expect(next.scenes[0].narration).toBe('Keep me')
    expect(next.settings.tone).toBe('calm')
    expect(next.settings.templateId).toBe('tmpl_x')
    expect(next.scenes[0].transition).toBe('fade')
  })
})

import { describe, expect, it } from 'vitest'
import { defaultClipSettings } from '@/lib/clips/settings'
import { speakercropLayoutEnv } from '@/lib/clips/speakercrop-layout-env'

describe('clip layout → speakercrop env', () => {
  it('matches worker payload for fill/fit/split', () => {
    expect(speakercropLayoutEnv('fill').LAYOUT_MODE).toBe('fill')
    expect(speakercropLayoutEnv('fit').LAYOUT_MODE).toBe('fit')
    expect(speakercropLayoutEnv('split').MULTIPERSON).toBe('1')
    expect(speakercropLayoutEnv('split').FORCE_SPLIT).toBe('1')
  })

  it('project settings layout reaches renderer env shape', () => {
    const settings = defaultClipSettings({ layout: 'fill' })
    const env = speakercropLayoutEnv(settings.layout)
    expect(env.LAYOUT_STYLE).toBe('fill')
    expect(env.MULTIPERSON).toBeUndefined()
  })
})

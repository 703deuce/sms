import { describe, expect, it } from 'vitest'
import { editorLayoutToWorker } from '@/lib/clips/layout-mode-map'
import { defaultClipSettings } from '@/lib/clips/settings'
import { speakercropLayoutEnv } from '@/lib/clips/speakercrop-layout-env'

describe('clip layout → speakercrop env', () => {
  it('matches worker payload for fill/fit/split', () => {
    expect(speakercropLayoutEnv('fill').LAYOUT_MODE).toBe('fill')
    expect(speakercropLayoutEnv('fit').LAYOUT_MODE).toBe('fit')
    expect(speakercropLayoutEnv('split').REFRAME_V).toBe('2')
    expect(speakercropLayoutEnv('split').FORCE_SPLIT).toBe('1')
  })

  it('grid3 and grid4 enable reframe v2', () => {
    expect(speakercropLayoutEnv('grid3').LAYOUT_MODE).toBe('grid3')
    expect(speakercropLayoutEnv('grid3').REFRAME_V).toBe('2')
    expect(speakercropLayoutEnv('grid4').LAYOUT_STYLE).toBe('grid4')
  })

  it('speaker_follow stays legacy (no REFRAME_V)', () => {
    expect(speakercropLayoutEnv('speaker_follow').REFRAME_V).toBeUndefined()
  })

  it('project settings layout reaches renderer env shape', () => {
    const settings = defaultClipSettings({ layout: 'fill' })
    const env = speakercropLayoutEnv(settings.layout)
    expect(env.LAYOUT_STYLE).toBe('fill')
    expect(env.REFRAME_V).toBeUndefined()
  })

  it('editor per-clip modes map to worker layout ids', () => {
    expect(editorLayoutToWorker('fit_blur')).toBe('fit')
    expect(editorLayoutToWorker('center_crop')).toBe('fill')
    expect(editorLayoutToWorker('grid3')).toBe('grid3')
    expect(speakercropLayoutEnv(editorLayoutToWorker('fit_blur')).LAYOUT_MODE).toBe('fit')
    expect(speakercropLayoutEnv(editorLayoutToWorker('grid4')).REFRAME_V).toBe('2')
  })
})

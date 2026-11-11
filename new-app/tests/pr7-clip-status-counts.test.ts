import { describe, expect, it } from 'vitest'
import { formatClipProgressStage } from '@/lib/clips/progress-stage'

describe('PR7 LG11 progress labels for historical clip counters', () => {
  it('shows valid reframe and render counters', () => {
    expect(formatClipProgressStage('reframe_1_of_19')).toBe('Reframing clip 1 of 19')
    expect(formatClipProgressStage('render_19_of_19')).toBe('Rendering clip 19 of 19')
    expect(formatClipProgressStage('Rendering 3/7')).toBe('Rendering clip 3 of 7')
  })
  it('never presents impossible or backwards counters as real progress', () => {
    expect(formatClipProgressStage('reframe_14_of_10')).toBe('Reframing clips')
    expect(formatClipProgressStage('reframe_0_of_9')).toBe('Reframing clips')
    expect(formatClipProgressStage('render_7_of_0')).toBe('Rendering clips')
    expect(formatClipProgressStage('Rendering 12/2')).toBe('Rendering clips')
  })
  it('keeps scan and ranking as distinct stages', () => {
    expect(formatClipProgressStage('scanning')).toBe('Scanning scenes')
    expect(formatClipProgressStage('picker_pass1')).toBe('Ranking moments (pass 1)')
    expect(formatClipProgressStage('vision_rank')).toBe('Vision ranking')
  })
})

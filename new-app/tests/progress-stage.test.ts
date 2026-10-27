import { describe, expect, it } from 'vitest'
import { formatClipProgressStage } from '@/lib/clips/progress-stage'

describe('formatClipProgressStage', () => {
  it('formats reframe stage', () => {
    expect(formatClipProgressStage('reframe_2_of_5')).toBe('Reframing clip 2 of 5')
  })

  it('formats known picker stages', () => {
    expect(formatClipProgressStage('picker_pass1')).toBe('Ranking moments (pass 1)')
  })
})

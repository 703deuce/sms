import { describe, expect, it } from 'vitest'
import {
  LANDSCAPE_LAYOUT_FIXTURE,
  landscapeLayoutWorker,
  landscapeLayoutVisible,
} from '@/lib/clips/editor/landscape-layouts'

describe('landscape-layouts', () => {
  for (const [mode, worker] of Object.entries(LANDSCAPE_LAYOUT_FIXTURE)) {
    it(`TS ${mode} → ${worker}`, () => {
      expect(landscapeLayoutWorker(mode === 'unknown_mode' ? 'nope' : mode)).toBe(worker)
    })
  }

  it('hides follow/grid modes on landscape panel', () => {
    expect(landscapeLayoutVisible('speaker_follow')).toBe(false)
    expect(landscapeLayoutVisible('full_frame')).toBe(true)
  })
})

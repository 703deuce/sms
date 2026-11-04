// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { LANE_H_DEFAULT, laneHeights, clampLaneH } from '@/lib/clips/editor/lane-heights'
import { readEditorPanelWidthPx } from '@/lib/clips/editor/use-editor-panel-width'

afterEach(() => localStorage.clear())

describe('unified editor density defaults', () => {
  it('allocates more width to the transcript and player by default', () => {
    expect(readEditorPanelWidthPx()).toBe(294)
    localStorage.setItem('transovo.editor.panelWidthPx.v3', '348')
    expect(readEditorPanelWidthPx()).toBe(348)
  })

  it('starts with compact, readable timeline lanes rather than tall caption chips', () => {
    expect(LANE_H_DEFAULT.text).toBe(36)
    expect(LANE_H_DEFAULT.captions).toBe(32)
    expect(LANE_H_DEFAULT.broll).toBe(48)
    expect(LANE_H_DEFAULT.video).toBe(82)
  })

  it('still respects user-adjusted lane heights and existing minimums', () => {
    expect(laneHeights({ text: 65 }).text).toBe(65)
    expect(clampLaneH('text', 4)).toBeGreaterThanOrEqual(28)
  })
})

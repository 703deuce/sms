import { describe, expect, it } from 'vitest'
import { EDITOR_GRID } from '@/components/clips/editor/editor-layout'
import { clampLaneH, LANE_H_DEFAULT, laneHeights, sanitizeLaneHeights } from '@/lib/clips/editor/lane-heights'

describe('TIMELINE_LAYOUT4 rail full height on the right', () => {
  it('rail spans both grid rows in column 4; timeline stops before the rail', () => {
    expect(EDITOR_GRID.railDock).toContain('lg:col-start-4')
    expect(EDITOR_GRID.railDock).toContain('lg:row-span-2')
    expect(EDITOR_GRID.timelineDock).toContain('lg:col-[1/4]')
  })
  it('timeline dock does not scroll itself (only the timeline body scrolls)', () => {
    expect(EDITOR_GRID.timelineDock).not.toContain('overflow-y-auto')
    expect(EDITOR_GRID.timelineDock).not.toContain('max-h-')
  })
})

describe('TIMELINE_LAYOUT4 lane heights', () => {
  it('raised defaults', () => {
    expect(LANE_H_DEFAULT.text).toBeGreaterThanOrEqual(36)
    expect(LANE_H_DEFAULT.voice).toBeGreaterThanOrEqual(48)
    expect(LANE_H_DEFAULT.music).toBeGreaterThanOrEqual(48)
    expect(LANE_H_DEFAULT.broll).toBeGreaterThanOrEqual(56)
    expect(LANE_H_DEFAULT.video).toBe(90)
  })
  it('clamps and sanitizes stored heights', () => {
    expect(clampLaneH('text', 5)).toBe(28)
    expect(clampLaneH('video', 9999)).toBe(220)
    expect(sanitizeLaneHeights({ text: 70.4, bogus: 3, music: 'x' })).toEqual({ text: 70 })
    expect(laneHeights({ sfx: 100 }).sfx).toBe(100)
    expect(laneHeights({}).broll).toBe(LANE_H_DEFAULT.broll)
  })
})

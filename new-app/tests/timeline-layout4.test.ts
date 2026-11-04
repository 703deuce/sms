import { describe, expect, it } from 'vitest'
import { EDITOR_GRID } from '@/components/clips/editor/editor-layout'
import { clampLaneH, LANE_H_DEFAULT, laneHeights, sanitizeLaneHeights } from '@/lib/clips/editor/lane-heights'

describe('TIMELINE_LAYOUT5 tab strip on top of the tools card', () => {
  it('tools card in row 1; preview/properties row 1 only; timeline row 2', () => {
    expect(EDITOR_GRID.toolsDock).toContain('lg:col-start-1')
    expect(EDITOR_GRID.toolsDockPanel).toContain('flex-1')
    expect(EDITOR_GRID.previewDock).toContain('lg:row-start-1')
    expect(EDITOR_GRID.previewDock).not.toContain('row-span-2')
    expect(EDITOR_GRID.propertiesDock).toContain('lg:row-start-1')
    expect(EDITOR_GRID.propertiesDock).not.toContain('row-span-2')
    expect(EDITOR_GRID.timelineDock).toContain('lg:row-start-2')
    expect(EDITOR_GRID.rootDock).toContain('lg:grid-rows-[minmax(0,1fr)_auto]')
  })
  it('script dock uses two-column grid without tools column', () => {
    expect(EDITOR_GRID.rootDockScript).toContain('lg:grid-cols-[minmax(0,1fr)_auto]')
    expect(EDITOR_GRID.rootDockScript).not.toMatch(/lg:grid-cols-\[auto_minmax/)
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

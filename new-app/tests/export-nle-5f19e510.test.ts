import { describe, expect, it } from 'vitest'
import { displayDurationMs } from '@/lib/clips/edits'
import { clipEditsToNleTimelineSegments } from '@/lib/clips/export-nle-timeline'
import { buildFcpxmlFromClipEdits } from '@/lib/clips/export-xml'
import { buildPremiereXmlFromClipEdits } from '@/lib/clips/export-premiere-xml'
import { CLIP_5F19E510_BOUNDS, clip5f19e510Edits } from '@/tests/fixtures/clip-5f19e510-edits'

describe('NLE export clip_5f19e510', () => {
  const edits = clip5f19e510Edits()
  const bounds = CLIP_5F19E510_BOUNDS

  it('honors video split, cut range, and speed segments on the display timeline', () => {
    const { segments, timelineDurationSec } = clipEditsToNleTimelineSegments(edits, bounds)
    expect(segments.length).toBeGreaterThanOrEqual(8)
    expect(segments[0]?.sourceStartSec).toBe(0)
    expect(segments[0]?.offsetSec).toBe(0)
    expect(segments.some((s) => Math.abs(s.sourceStartSec - 4.641) < 0.01)).toBe(true)
    expect(segments.some((s) => Math.abs(s.sourceStartSec - 29.695) < 0.01)).toBe(true)
    expect(segments.some((s) => s.speed === 0.4)).toBe(true)
    expect(segments.some((s) => s.speed === 1.75)).toBe(true)
    const last = segments[segments.length - 1]!
    expect(last.offsetSec + last.durationSec).toBeCloseTo(timelineDurationSec, 2)
    expect(timelineDurationSec).toBeCloseTo(displayDurationMs(edits) / 1000, 1)
    expect(timelineDurationSec).toBeGreaterThan(39)
    expect(timelineDurationSec).toBeLessThan(41.5)
  })

  it('fcpxml sequence duration and first clip source in at 0s (not edit-ms offset)', () => {
    const fcpx = buildFcpxmlFromClipEdits({
      title: 'clip',
      clipStartMs: 0,
      clipEndMs: 32_000,
      edits,
      bounds,
      sourceMediaHref: 'file:///short.mp4',
      sourceMediaFilename: 'short.mp4',
    })
    expect(fcpx).toContain('duration="40')
    expect(fcpx).toMatch(/<asset-clip[^>]+start="0s"/)
    expect(fcpx).not.toMatch(/start="1\.12s"/)
    expect(fcpx).toContain('<timeMap>')
  })

  it('premiere xml uses source in at frame 0 for the first clip', () => {
    const xml = buildPremiereXmlFromClipEdits({
      title: 'clip',
      clipStartMs: 0,
      clipEndMs: 32_000,
      edits,
      bounds,
      sourceMediaFilename: 'short.mp4',
      sourceMediaHref: 'file:///short.mp4',
    })
    expect(xml).toContain('<in>0</in>')
    expect(xml).not.toContain('<in>34</in>')
  })
})

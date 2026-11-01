import { describe, expect, it } from 'vitest'
import {
  buildClipTimelineFcpxml,
  buildFcpxmlFromClipEdits,
  clipEditsToFcpxmlSegments,
  fcpxmlDownloadFilename,
  msToFcpxSeconds,
} from '@/lib/clips/export-xml'
import { defaultEdits } from '@/lib/clips/edits'

describe('export-xml fcpxml', () => {
  it('maps keep segments to timeline offsets', () => {
    const bounds = { clipStartMs: 10_000, clipEndMs: 25_000 }
    const edits = defaultEdits(bounds)
    edits.trim.in = 0
    edits.trim.out = 5_000
    edits.cutRanges = [[1500, 2500]]
    const { segments } = clipEditsToFcpxmlSegments(edits, bounds)
    expect(segments.length).toBe(2)
    expect(segments[0]?.offsetSec).toBe(0)
    expect(segments[1]?.offsetSec).toBe(msToFcpxSeconds(1500))
    expect(segments[0]?.sourceStartSec).toBe(msToFcpxSeconds(10_000))
  })

  it('emits fcpxml document with asset clips', () => {
    const xml = buildClipTimelineFcpxml({
      title: 'Test clip',
      sourceMediaHref: 'file:///media/source.mp4',
      sourceDurationSec: 12,
      segments: [{ offsetSec: 0, sourceStartSec: 1, durationSec: 3 }],
      fps: 30,
      width: 1080,
      height: 1920,
    })
    expect(xml).toContain('<!DOCTYPE fcpxml>')
    expect(xml).toContain('<asset-clip')
    expect(xml).toContain('file:///media/source.mp4')
  })

  it('builds from clip edits with placeholder source', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
    const xml = buildFcpxmlFromClipEdits({
      title: 'My Clip',
      clipStartMs: 0,
      clipEndMs: 10_000,
      edits: defaultEdits(bounds),
      bounds,
      sourceMediaHref: 'file:///SOURCE_MEDIA',
    })
    expect(xml).toContain('My Clip')
    expect(xml).toContain('file:///SOURCE_MEDIA')
  })

  it('sanitizes download filename', () => {
    expect(fcpxmlDownloadFilename('Hello world!')).toBe('Hello-world.fcpxml')
  })
})

import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import {
  buildNleExportFileMap,
  buildNleExportReadme,
  nleZipDownloadFilename,
  sourceMediaFileHref,
  zipNleExportFiles,
} from '@/lib/clips/export-nle-bundle'
import { buildPremiereXmlFromClipEdits } from '@/lib/clips/export-premiere-xml'

describe('export-nle-bundle', () => {
  it('sourceMediaFileHref uses basename file URL', () => {
    expect(sourceMediaFileHref('folder/short_apex_32s.mp4')).toBe('file:///short_apex_32s.mp4')
  })

  it('buildNleExportFileMap includes fcpxml, premiere, srt, readme', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 32_000 }
    const files = buildNleExportFileMap({
      title: 'short apex 32s',
      sourceMediaFilename: 'short_apex_32s.mp4',
      clipStartMs: 0,
      clipEndMs: 32_000,
      edits: defaultEdits(bounds),
      bounds,
      srt: '1\n00:00:00,000 --> 00:00:01,000\nHello\n',
    })
    const fcpxName = Object.keys(files).find((k) => k.endsWith('.fcpxml'))
    expect(fcpxName).toBeTruthy()
    expect(Object.keys(files).sort()).toEqual(
      [fcpxName!, 'README.txt', 'captions.srt', 'premiere.xml'].sort(),
    )
    expect(files[fcpxName!]).toContain('<!DOCTYPE fcpxml>')
    expect(files[fcpxName!]).toContain('file:///short_apex_32s.mp4')
    expect(files[fcpxName!]).toContain('name="short_apex_32s.mp4"')
    expect(files['premiere.xml']).toContain('<!DOCTYPE xmeml>')
    expect(files['premiere.xml']).toContain('file-1')
    expect(files['README.txt']).toContain('short_apex_32s.mp4')
    expect(files['README.txt']).toContain('Relink')
    expect(files['captions.srt']).toContain('Hello')
  })

  it('premiere xml references source pathurl', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
    const xml = buildPremiereXmlFromClipEdits({
      title: 'T',
      clipStartMs: 0,
      clipEndMs: 10_000,
      edits: defaultEdits(bounds),
      bounds,
      sourceMediaFilename: 'take.mp4',
      sourceMediaHref: 'file:///take.mp4',
    })
    expect(xml).toContain('<pathurl>file:///take.mp4</pathurl>')
    expect(xml).toContain('<name>take.mp4</name>')
  })

  it('zipNleExportFiles returns a zip buffer', async () => {
    const buf = await zipNleExportFiles({ 'a.txt': 'hello', 'b.txt': 'world' })
    expect(buf.subarray(0, 2).toString()).toBe('PK')
    expect(buf.length).toBeGreaterThan(20)
  })

  it('sanitizes zip download filename', () => {
    expect(nleZipDownloadFilename('Hello!')).toBe('Hello-nle.zip')
  })

  it('readme lists premiere and resolve labels', () => {
    const text = buildNleExportReadme({
      title: 'Clip',
      sourceMediaFilenames: ['a.mp4'],
      fcpxmlName: 'clip.fcpxml',
    })
    expect(text).toContain('Premiere Pro')
    expect(text).toContain('Resolve')
    expect(text).toContain('FCPXML 1.10')
  })
})

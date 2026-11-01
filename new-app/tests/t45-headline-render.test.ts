import { describe, expect, it } from 'vitest'
import { CLIP_RENDER_PIPELINE_REV, renderVersionHash } from '@/lib/clips/export-aspect'
import { fitHeadlineDisplayForBox, fitHeadlineDisplayLines } from '@/lib/clips/headline-fit'
import { formatHeadlineForExport } from '@/lib/clips/export-template'

describe('T4.5 render cache version', () => {
  it('includes pipeline rev in render hash', () => {
    const hash = renderVersionHash('abc', '9:16', '1080p')
    expect(hash.startsWith(`${CLIP_RENDER_PIPELINE_REV}:`)).toBe(true)
    expect(hash).not.toBe('abc:9:16:1080p')
  })

  it('pipeline rev bump invalidates pre-worker-fix reuse keys', () => {
    const hash = renderVersionHash('abc', '9:16', '720p')
    expect(hash).toBe(`${CLIP_RENDER_PIPELINE_REV}:abc:9:16:720p`)
    expect(hash).not.toBe('t47-v1:abc:9:16:720p')
  })
})

describe('headline fit', () => {
  it('does not drop trailing words from long headlines', () => {
    const raw =
      "After 'Kobe's cracked,' a reaction leads into 'There we go,' and the clip keeps going"
    const headline = formatHeadlineForExport(raw)
    const lines = fitHeadlineDisplayLines(headline)
    const joined = lines.join(' ')
    expect(joined).toMatch(/GO/i)
    expect(joined).toMatch(/THERE WE/i)
  })

  it('shrinks font before hard truncation in box fit', () => {
    const headline = formatHeadlineForExport(
      "AFTER 'KOBE'S CRACKED,' A REACTION LEADS INTO 'THERE WE GO,'",
    )
    const { lines, fontPx } = fitHeadlineDisplayForBox(headline, 320, 72)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.join(' ')).toMatch(/GO/)
    expect(fontPx).toBeLessThan(40)
  })
})

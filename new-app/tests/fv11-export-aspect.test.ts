import { describe, expect, it } from 'vitest'
import {
  customAspectToken,
  exportPixelSize,
  parseExportAspect,
  renderVersionHash,
} from '@/lib/clips/export-aspect'

describe('FV-11 export-aspect', () => {
  it('exportPixelSize preserves legacy presets at 720p and 1080p', () => {
    expect(exportPixelSize('9:16', '720p')).toEqual({ width: 720, height: 1280 })
    expect(exportPixelSize('1:1', '720p')).toEqual({ width: 720, height: 720 })
    expect(exportPixelSize('16:9', '720p')).toEqual({ width: 1280, height: 720 })
    expect(exportPixelSize('4:5', '720p')).toEqual({ width: 720, height: 900 })
    expect(exportPixelSize('9:16', '1080p')).toEqual({ width: 1080, height: 1920 })
    expect(exportPixelSize('1:1', '1080p')).toEqual({ width: 1080, height: 1080 })
    expect(exportPixelSize('16:9', '1080p')).toEqual({ width: 1920, height: 1080 })
    expect(exportPixelSize('4:5', '1080p')).toEqual({ width: 1080, height: 1350 })
  })

  it('new presets 4:3 and 21:9', () => {
    expect(exportPixelSize('4:3', '720p')).toEqual({ width: 960, height: 720 })
    expect(exportPixelSize('4:3', '1080p')).toEqual({ width: 1440, height: 1080 })
    expect(exportPixelSize('21:9', '720p')).toEqual({ width: 1680, height: 720 })
    expect(exportPixelSize('21:9', '1080p')).toEqual({ width: 2520, height: 1080 })
  })

  it('custom aspect scaling', () => {
    expect(exportPixelSize('custom:1440x1080', '720p')).toEqual({ width: 960, height: 720 })
    expect(exportPixelSize('custom:1080x1440', '1080p')).toEqual({ width: 1080, height: 1440 })
    expect(exportPixelSize('custom:3000x1000', '1080p')).toEqual({ width: 3240, height: 1080 })
    const capped = exportPixelSize('custom:3840x3840', '1080p')
    expect(Math.max(capped.width, capped.height)).toBeLessThanOrEqual(3840)
  })

  it('parseExportAspect', () => {
    expect(parseExportAspect('21:9')).toBe('21:9')
    expect(parseExportAspect('custom:1441x1081')).toBe('custom:1440x1080')
    expect(parseExportAspect('custom:100x100')).toBe('custom:240x240')
    expect(parseExportAspect('custom:4000x500')).toBeUndefined()
    expect(parseExportAspect('2:1')).toBeUndefined()
    expect(parseExportAspect('')).toBeUndefined()
    expect(parseExportAspect(null)).toBeUndefined()
    expect(parseExportAspect('custom:axb')).toBeUndefined()
  })

  it('renderVersionHash differs for portrait vs landscape custom', () => {
    const h = 'abc'
    expect(renderVersionHash(h, 'custom:1440x1080', '720p')).not.toBe(renderVersionHash(h, 'custom:1080x1440', '720p'))
  })
})

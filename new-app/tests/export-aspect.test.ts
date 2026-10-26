import { describe, expect, it } from 'vitest'
import { exportPixelSize } from '@/lib/clips/export-aspect'

describe('exportPixelSize', () => {
  it('720p sizes', () => {
    expect(exportPixelSize('9:16', '720p')).toEqual({ width: 720, height: 1280 })
    expect(exportPixelSize('1:1', '720p')).toEqual({ width: 720, height: 720 })
    expect(exportPixelSize('16:9', '720p')).toEqual({ width: 1280, height: 720 })
  })

  it('1080p sizes', () => {
    expect(exportPixelSize('9:16', '1080p')).toEqual({ width: 1080, height: 1920 })
    expect(exportPixelSize('1:1', '1080p')).toEqual({ width: 1080, height: 1080 })
    expect(exportPixelSize('16:9', '1080p')).toEqual({ width: 1920, height: 1080 })
  })
})

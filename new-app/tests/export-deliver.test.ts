import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DELIVER,
  DELIVER_CONTENT_TYPES,
  deliverExt,
  isDefaultDeliver,
  normalizeDeliver,
} from '@/lib/clips/export-deliver'

const baseCtx = { canHigh: true, lengthMs: 60_000, hasInOut: true, platform: false }

describe('normalizeDeliver', () => {
  it('returns null for default mp4 path', () => {
    expect(normalizeDeliver({}, baseCtx)).toBeNull()
    expect(isDefaultDeliver(DEFAULT_DELIVER)).toBe(true)
  })

  it('GIF forces 720p and default fps 12', () => {
    const d = normalizeDeliver({ format: 'gif', fps: 30 }, { ...baseCtx, lengthMs: 20_000 })
    expect(d?.format).toBe('gif')
    expect(d?.targetResolution).toBe('720p')
    expect(d?.fps).toBe(12)
  })

  it('rejects GIF over 30s to mp4 default', () => {
    expect(normalizeDeliver({ format: 'gif' }, { ...baseCtx, lengthMs: 31_000 })).toBeNull()
  })

  it('2160p over 10 min downgrades to 1080p deliver target', () => {
    const d = normalizeDeliver({ targetResolution: '2160p', codec: 'hevc' }, { ...baseCtx, lengthMs: 11 * 60_000 })
    expect(d?.targetResolution).toBe('1080p')
  })

  it('no entitlement downgrades high res to 720p', () => {
    const d = normalizeDeliver({ targetResolution: '1080p', codec: 'hevc' }, { ...baseCtx, canHigh: false })
    expect(d?.targetResolution).toBe('720p')
  })

  it('platform forces default path', () => {
    expect(normalizeDeliver({ format: 'gif' }, { ...baseCtx, platform: true })).toBeNull()
  })

  it('still needs stillAtMs', () => {
    expect(normalizeDeliver({ format: 'png' }, baseCtx)).toBeNull()
    const d = normalizeDeliver({ format: 'png', stillAtMs: 4000 }, baseCtx)
    expect(d?.stillAtMs).toBe(4000)
  })

  it('range needs valid in/out when hasInOut', () => {
    expect(normalizeDeliver({ rangeInMs: 1000, rangeOutMs: 2000 }, baseCtx)?.rangeInMs).toBe(1000)
    expect(normalizeDeliver({ rangeInMs: 1000, rangeOutMs: 2000 }, { ...baseCtx, hasInOut: false })).toBeNull()
  })
})

describe('deliverExt and content types', () => {
  it('maps extensions', () => {
    expect(deliverExt({ ...DEFAULT_DELIVER, format: 'm4a' })).toBe('m4a')
    expect(DELIVER_CONTENT_TYPES.mp4).toBe('video/mp4')
    expect(DELIVER_CONTENT_TYPES.png).toBe('image/png')
  })
})

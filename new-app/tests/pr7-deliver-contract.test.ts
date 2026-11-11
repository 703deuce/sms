import { describe, expect, it } from 'vitest'
import { DEFAULT_DELIVER, normalizeDeliver, stableDeliverJson } from '@/lib/clips/export-deliver'

const context = { canHigh: true, canPro: true, lengthMs: 35_000, hasInOut: true, platform: false }

describe('PR7 XE02/XE07 audio and embedded subtitle request contract', () => {
  it.each(['mp3', 'm4a', 'wav', 'flac'] as const)('preserves explicit %s and refuses soft-subtitle audio mux', format => {
    const deliver = normalizeDeliver({ format, softSubs: true }, context)
    expect(deliver).toMatchObject({ format, codec: 'h264', quality: 'standard', fps: 'source' })
    expect(deliver?.softSubs).toBeUndefined()
  })

  it.each(['mp4', 'mov'] as const)('keeps soft subtitles as a separate mux flag for %s', format => {
    const deliver = normalizeDeliver({ format, softSubs: true }, context)
    expect(deliver?.format).toBe(format)
    expect(deliver?.softSubs).toBe(true)
    expect(stableDeliverJson(deliver!)).toContain('"softSubs":true')
  })

  it('does not silently set soft subtitles for an unchanged standard MP4', () => {
    expect(normalizeDeliver({}, context)).toBeNull()
    expect(DEFAULT_DELIVER.softSubs).toBeUndefined()
    expect(normalizeDeliver({ format: 'gif', softSubs: true }, { ...context, lengthMs: 20_000 })?.softSubs).toBeUndefined()
  })
})

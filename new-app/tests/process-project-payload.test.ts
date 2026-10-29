import { describe, expect, it } from 'vitest'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { defaultClipSettings } from '@/lib/clips/settings'

describe('buildProcessProjectJobPayload', () => {
  it('non-BYO payload matches pinned snapshot (byte-identical job fields)', () => {
    const settings = defaultClipSettings()
    expect(buildProcessProjectJobPayload(settings)).toMatchInlineSnapshot(`
      {
        "genre": "auto",
        "mode": "auto",
        "target_clip_len_s": null,
      }
    `)
  })

  it('BYO adds only byo:true', () => {
    const base = buildProcessProjectJobPayload(defaultClipSettings())
    const byo = buildProcessProjectJobPayload(defaultClipSettings({ byo: true }))
    expect(byo).toEqual({ ...base, byo: true })
  })
})

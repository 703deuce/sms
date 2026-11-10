import { describe, expect, it } from 'vitest'
import { parseSettings } from '@/lib/server/clips/projects'
import { clipProjectSettingsSchema, defaultClipSettings } from '@/lib/clips/settings'
import { captionsOnlyProjectSettings } from '@/lib/ai-captions/auto-agent-guard'

describe('YouTube output legacy clip settings', () => {
  it('can open older projects without v, using v2 defaults', () => {
    const settings = parseSettings({ rangeStartMs: 0, rangeEndMs: 46000 }, 'proj_e703413257dc404482d0fad841cecadd')
    expect(settings.v).toBe(2)
    expect(settings.layout).toBe(defaultClipSettings().layout)
    expect(settings.rangeEndMs).toBe(46000)
    expect(parseSettings({ captionsOnly: true }, 'proj_648ab09cb15e470ba256c936b5781360').v).toBe(2)
  })
  it('creates schema-valid settings while retaining transcribeOnly guard', () => {
    const settings = { ...defaultClipSettings(), ...captionsOnlyProjectSettings(92000) }
    expect(clipProjectSettingsSchema.parse(settings).v).toBe(2)
    expect(settings.captionsOnly).toBe(true)
    expect(settings.rangeEndMs).toBe(92000)
  })
  it('does not silently reclassify an explicitly incompatible settings version', () => {
    expect(() => parseSettings({ v: 1 })).toThrow()
  })
})

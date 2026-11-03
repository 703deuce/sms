import { describe, expect, it } from 'vitest'
import { initialNewProjectSettings } from '@/lib/clips/new-project-initial'
import { TOOL_PRESET_MAP } from '@/lib/clips/settings'

describe('FIX2 R1 new project defaults', () => {
  it('defaults to Auto variety', () => {
    expect(initialNewProjectSettings(null, false).layout).toBe('auto')
    expect(initialNewProjectSettings('no-such-preset', false).layout).toBe('auto')
    expect(initialNewProjectSettings('ai-clip-maker', false).layout).toBe('auto')
  })
  it('a preset with its own layout keeps it; others get auto', () => {
    for (const [id, p] of Object.entries(TOOL_PRESET_MAP)) {
      const want = p.layout ?? 'auto'
      expect(initialNewProjectSettings(id, false).layout).toBe(want)
    }
  })
  it('full-video intent unchanged', () => {
    const s = initialNewProjectSettings(null, true)
    expect(s.fullVideo).toBe(true)
    expect(s.byo).toBe(true)
    expect(s.aspectRatio).toBe('16:9')
  })
})

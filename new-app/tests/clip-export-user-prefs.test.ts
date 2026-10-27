import { describe, expect, it } from 'vitest'
import { mergeClipExportUserPrefs } from '@/lib/clips/clip-export-user-types'

describe('clip export user prefs', () => {
  it('merges server json with safe defaults', () => {
    const merged = mergeClipExportUserPrefs({
      profanityCensor: true,
      headlineBarEnabled: false,
      exportSfx: 'subtle',
      defaultAspect: '9:16',
    })
    expect(merged.profanityCensor).toBe(true)
    expect(merged.headlineBarEnabled).toBe(false)
    expect(merged.exportSfx).toBe('subtle')
    expect(merged.defaultAspect).toBe('9:16')
    expect(merged.channelLinkEnabled).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  applyExportPreferencesToTemplate,
  defaultExportDialogPreferences,
} from '@/lib/clips/export-preferences'
import { defaultStreamHeadlineExportTemplate } from '@/lib/clips/export-template'

describe('export preferences', () => {
  it('applies remembered toggles to stream template', () => {
    const prefs = { ...defaultExportDialogPreferences(), headlineBarEnabled: false, platformBadgeEnabled: false }
    const tpl = applyExportPreferencesToTemplate(
      defaultStreamHeadlineExportTemplate({ platform: 'twitch', channelUrl: 'https://twitch.tv/x' }),
      prefs,
    )
    expect(tpl.headlineBar?.enabled).toBe(false)
    expect(tpl.platformBadge?.enabled).toBe(false)
    expect(tpl.channelLink?.enabled).toBe(true)
  })
})

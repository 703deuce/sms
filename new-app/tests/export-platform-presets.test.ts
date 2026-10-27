import { describe, expect, it } from 'vitest'
import {
  applyExportPlatformToEdits,
  exportPlatformDurationWarning,
  EXPORT_PLATFORM_PRESETS,
} from '@/lib/clips/export-platform-presets'
import { defaultEdits } from '@/lib/clips/edits'

describe('export platform presets', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 45_000 }

  it('applies TikTok safe caption margin', () => {
    const edits = applyExportPlatformToEdits(defaultEdits(bounds), 'tiktok')
    expect(edits.aspectRatio).toBe('9:16')
    expect(edits.captions?.marginVPct).toBe(EXPORT_PLATFORM_PRESETS.tiktok.captionSafeMarginVPct)
  })

  it('warns when clip exceeds platform max', () => {
    const warn = exportPlatformDurationWarning('youtube_shorts', 75_000)
    expect(warn).toMatch(/longer than/)
  })
})

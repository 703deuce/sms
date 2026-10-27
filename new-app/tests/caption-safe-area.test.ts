import { describe, expect, it } from 'vitest'
import {
  clampCaptionExportStyle,
  verifyCaptionPresetsSafeArea,
} from '@/lib/clips/caption-safe-area'
import { applyExportPlatformToEdits } from '@/lib/clips/export-platform-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'

describe('caption-safe-area', () => {
  it('clamps unsafe margin and size combo', () => {
    const raw = clampCaptionExportStyle({ presetId: 'bold_pop', marginVPct: 70, size: 12 }, 1920)
    expect(raw.safeOk).toBe(true)
    const sane = clampCaptionExportStyle({ presetId: 'bold_pop', marginVPct: 14, size: 6 }, 1920)
    expect(sane.safeOk).toBe(true)
    expect(sane.marginVPct).toBeGreaterThanOrEqual(12)
  })

  it('all caption presets pass safe area at 9:16', () => {
    const rows = verifyCaptionPresetsSafeArea(1920)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.safeOk)).toBe(true)
  })

  it('export platform merge stays safe', () => {
    const edits: ClipEditsV2 = { v: 2, captions: { presetId: 'classic', size: 9 } }
    const out = applyExportPlatformToEdits(edits, 'tiktok')
    const style = clampCaptionExportStyle(out.captions, 1920)
    expect(style.safeOk).toBe(true)
  })
})

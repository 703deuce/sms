import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { previewExportMatchesDefault } from '@/lib/clips/export-edits-match'
import { exportTimeMap, gapAtDisplayMs } from '@/lib/clips/editor/export-time'
import { graphemes } from '@/lib/clips/render-plan/text-anim'

describe('ChatGPT audit fixes (2026-11-18)', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60000 }
  it('a caption color change can never reuse the pre-edit preview', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    expect(previewExportMatchesDefault(base, bounds)).toBe(true)
    const edited = { ...base, captions: { ...(base.captions ?? {}), highlightColor: '#FF00AA' } } as typeof base
    expect(previewExportMatchesDefault(edited, bounds)).toBe(false)
  })
  it('gap lookup at 2x matches the ruler (gap after 4s of source shows at 2-3s)', () => {
    const map = exportTimeMap([[0, 10000]], [{ id: 'g', sourceId: 'gap', atSrcMs: 4000, inMs: 0, durMs: 1000, audio: 'mute' }])
    expect(gapAtDisplayMs(map, 2500, 2)?.id).toBe('g')
    expect(gapAtDisplayMs(map, 4500, 2)).toBeNull()
  })
  it('char animation keeps emoji and accents whole', () => {
    expect(graphemes('a👍🏽🇺🇸e\u0301👨‍👩‍👧')).toEqual(['a', '👍🏽', '🇺🇸', 'e\u0301', '👨‍👩‍👧'])
  })
})

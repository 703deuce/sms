import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { previewExportMatchesDefault } from '@/lib/clips/export-edits-match'
import {
  exportLoudnessLufs,
  isSpeechLevelingEnabled,
  speechLevelingPatch,
} from '@/lib/clips/speech-leveling'
import { applyExportPolishEdits } from '@/lib/server/clips/apply-export-polish'

describe('speech leveling opt-in', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

  it('toggle off when only legacy loudnessLufs on clip', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), loudnessLufs: -14 }, bounds)
    expect(isSpeechLevelingEnabled(edits)).toBe(false)
    expect(exportLoudnessLufs(edits)).toBeUndefined()
    expect(previewExportMatchesDefault(edits, bounds)).toBe(true)
  })

  it('applies −14 LUFS on export polish only when enabled', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), ...speechLevelingPatch(true) }, bounds)
    const out = applyExportPolishEdits(edits, { removeDeadAir: false })
    expect(out.loudnessLufs).toBe(-14)
    const legacy = normalizeEdits({ ...defaultEdits(bounds), loudnessLufs: -14 }, bounds)
    const noOpt = applyExportPolishEdits(legacy, { removeDeadAir: false })
    expect(noOpt.loudnessLufs).toBeUndefined()
  })
})

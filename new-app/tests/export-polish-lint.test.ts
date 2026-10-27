import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import { exportPolishLint, exportPolishLintWarnings } from '@/lib/clips/export-polish-lint'

const bounds = { clipStartMs: 0, clipEndMs: 25_000 }

describe('exportPolishLint', () => {
  it('warns when captions off and length long for Shorts', () => {
    const edits = defaultEdits(bounds)
    edits.trim.out = 55_000
    edits.captions.enabled = false
    const items = exportPolishLint(edits, { exportPlatform: 'youtube_shorts' })
    const warnings = exportPolishLintWarnings(items)
    expect(warnings.some((w) => w.id === 'captions')).toBe(true)
    expect(warnings.some((w) => w.id === 'length')).toBe(true)
  })
})

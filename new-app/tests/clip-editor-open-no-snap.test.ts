import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { clip5f19e510Edits, CLIP_5F19E510_BOUNDS } from '@/tests/fixtures/clip-5f19e510-edits'

const here = dirname(fileURLToPath(import.meta.url))
const clipDetailSrc = readFileSync(join(here, '../lib/server/clips/clip-detail.ts'), 'utf8')

describe('clip editor open — no sentence snap persist', () => {
  it('getClipEditorPayload does not import or call on-open repair / clip.update', () => {
    expect(clipDetailSrc).not.toMatch(/sentence-snap|repairClipSentenceBounds|repairClipBoundsIfNeeded/)
    expect(clipDetailSrc).not.toMatch(/prisma\.clip\.update/)
    expect(clipDetailSrc).not.toMatch(/writeClipEdits/)
  })

  it('edited clip fixture JSON is stable (regression anchor for open read-only)', () => {
    const edits = clip5f19e510Edits()
    expect(edits.trim).toEqual({ in: 0, out: 32_000 })
    expect(edits.cutRanges).toEqual([[29_215, 29_695]])
    expect(edits.transitions).toEqual([{ type: 'spin', durMs: 1000, srcMs: 29_695 }])
    expect(edits.videoSplits).toEqual([4641])
    expect(CLIP_5F19E510_BOUNDS.clipStartMs).toBe(0)
  })
})

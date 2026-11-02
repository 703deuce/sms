import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { editorWordsForClipFillerReview } from '@/lib/clips/editor/filler-review-words'
import { fillerProposals } from '@/lib/clips/editor/cleanup-proposals'
import { findRetakes } from '@/lib/clips/editor/retakes'
import { loadSourceWords, wordsInRange } from '@/lib/clips/source-words'

const fixturePath = join(process.cwd(), 'tests/fixtures/cleanup-proj-eb785762-transcript-words.json')
const clipId = 'clip_fb8118406d454027a37ca2a420490f98'
const clipStartMs = 800
const clipEndMs = 81875

function loadClipEditorWords() {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8'))
  const projectWords = loadSourceWords(
    raw.map((w: { w: string; s: number; e: number }, i: number) => ({ w: w.w, s: w.s, e: w.e, i })),
  )
  const scoped = wordsInRange(projectWords, clipStartMs, clipEndMs)
  const bounds = {
    clipStartMs,
    clipEndMs,
    trimMinMs: 0,
    trimMaxMs: clipEndMs + 8000,
  }
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  return editorWordsForClipFillerReview(clipId, scoped, edits, bounds)
}

describe('cleanup prod words proj_eb785762 (after re-transcribe fixture)', () => {
  it('proposes all um/uh at normal strength', () => {
    const ordered = loadClipEditorWords()
    const deleted = new Set<string>()
    const props = fillerProposals(ordered, deleted, { strength: 'normal' })
    const umUh = ordered.filter((w) => /^(um|uh)/i.test(w.text.trim()))
    expect(umUh.length).toBeGreaterThanOrEqual(2)
    for (const w of umUh) {
      expect(
        props.some(
          (p) =>
            (p.kind === 'filler' || p.kind === 'repeat') &&
            p.range[0] <= w.t0Ms &&
            p.range[1] >= w.t1Ms,
        ),
      ).toBe(true)
    }
  })

  it('proposes and-and repeat chain near 53s', () => {
    const ordered = loadClipEditorWords()
    const props = fillerProposals(ordered, new Set(), { strength: 'normal' })
    const repeatNear53 = props.find(
      (p) => p.kind === 'repeat' && p.range[0] >= 50_000 && p.range[0] <= 56_000 && p.label.includes('and'),
    )
    expect(repeatNear53).toBeTruthy()
  })

  it('findRetakes on NASA fixture matches three grounded cuts only', () => {
    const raw = JSON.parse(readFileSync(fixturePath, 'utf8'))
    const scoped = wordsInRange(
      loadSourceWords(raw.map((w: { w: string; s: number; e: number }, i: number) => ({ ...w, i }))),
      clipStartMs,
      clipEndMs,
    )
    const retakeWords = scoped.map((w) => ({ w: w.w, s: w.s ?? 0, e: w.e ?? 0 }))
    const groups = findRetakes(retakeWords)
    expect(groups.length).toBe(3)
    const bad = groups.find((g) => {
      const t = g.attempts.map((a) => a.text).join(' ')
      return /Jalen/i.test(t) && /we're gonna see how this/i.test(t)
    })
    expect(bad).toBeUndefined()
  })
})

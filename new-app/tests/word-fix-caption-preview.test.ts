import { describe, expect, it } from 'vitest'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { defaultEdits, normalizeEdits, resolveWordFixText, type ClipEditsV2 } from '@/lib/clips/edits'
import { editorPreviewCaptionClipWords } from '@/lib/clips/editor-preview-edits'
import { editorEditsReducer } from '@/components/clips/editor/use-editor-state'
import { buildPreviewScripts } from '@/lib/clips/render-plan/preview-scripts'

const bounds = { clipStartMs: 0, clipEndMs: 10000 }

describe('word fix caption preview', () => {
  it('buildCaptionWords resolves fixes by idx when i is absent', () => {
    const edits: ClipEditsV2 = {
      ...normalizeEdits(defaultEdits(bounds), bounds),
      wordFixes: { '12': 'Cracked' },
    }
    const words = [{ w: 'cracked.', s: 1, e: 1.4, idx: 12 }]
    const caps = buildCaptionWords(words, edits)
    expect(caps[0]?.text).toBe('Cracked')
    const preview = editorPreviewCaptionClipWords(words, edits)
    expect(preview[0]?.w).toBe('Cracked')
  })

  it('resolveWordFixText maps by wordFixMeta source time when index differs', () => {
    const fixes = { '3': 'Cracked.' }
    const meta = { '3': { s: 19_050, w: 'cracked.' } }
    const w = { w: 'cracked.', s: 19.05, e: 19.4, i: 99 }
    expect(resolveWordFixText(w, fixes, meta)).toBe('Cracked.')
  })

  it('libass preview script includes word fix text', () => {
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        captions: { enabled: true, presetId: 'bold_pop', animation: 'pop', position: 'bottom', size: 6.5 },
        wordFixes: { '2': 'Cracked.' },
        wordFixMeta: { '2': { s: 19_000, w: 'cracked.' } },
      },
      bounds,
    )
    const caps = [{ w: 'Cracked.', s: 19, e: 19.5, i: 2, idx: 2 }]
    const scripts = buildPreviewScripts({
      edits: edits as unknown as Record<string, unknown>,
      words: caps,
      playW: 1080,
      playH: 1920,
      durationMs: 10_000,
    })
    expect(scripts.captions).toContain('Cracked.')
  })

  it('word text fix updates rendered preview caption words (bro → though)', () => {
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        captions: { enabled: true, presetId: 'bold_pop', animation: 'pop', position: 'bottom', size: 6.5 },
        wordFixes: { '7': 'though' },
        wordFixMeta: { '7': { s: 1000, w: 'bro' } },
      },
      bounds,
    )
    const words = [{ w: 'bro', s: 1, e: 1.35, i: 7 }]
    const preview = editorPreviewCaptionClipWords(words, edits)
    expect(preview.map((w) => w.w)).toContain('though')
    expect(preview.map((w) => w.w)).not.toContain('bro')
    const scripts = buildPreviewScripts({
      edits: edits as unknown as Record<string, unknown>,
      words: preview,
      playW: 1080,
      playH: 1920,
      durationMs: 10_000,
    })
    expect(scripts.captions).toMatch(/though/i)
    expect(scripts.captions).not.toMatch(/\bbro\b/i)
  })

  it('setWordFix uses a single pass-labeled undo step', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    let state = {
      edits: base,
      past: [] as ClipEditsV2[],
      pastLabels: [] as (string | undefined)[],
      future: [] as ClipEditsV2[],
      saveState: 'saved' as const,
      producerStrip: null,
    }
    const next = { ...base, wordFixes: { '3': 'Cracked' } }
    state = editorEditsReducer(state, { type: 'pass', edits: next, label: 'Word fix' })
    expect(state.past).toHaveLength(1)
    expect(state.pastLabels).toEqual(['Word fix'])
    expect(state.edits.wordFixes['3']).toBe('Cracked')
  })
})

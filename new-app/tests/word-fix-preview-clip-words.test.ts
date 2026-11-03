import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import {
  applyWordFixesToPreviewClipWords,
  editorPreviewCaptionClipWords,
} from '@/lib/clips/editor-preview-edits'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

describe('applyWordFixesToPreviewClipWords', () => {
  it('applies wordFixes to dub preview words', () => {
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        wordFixes: { '3': 'though' },
        wordFixMeta: { '3': { s: 500, w: 'bro' } },
      },
      bounds,
    )
    const dubWords = [{ w: 'bro', s: 0.5, e: 0.8, i: 3, idx: 3 }]
    const out = applyWordFixesToPreviewClipWords(dubWords, edits)
    expect(out[0]?.w).toBe('though')
    const transcript = editorPreviewCaptionClipWords([{ w: 'bro', s: 0.5, e: 0.8, i: 3 }], edits)
    expect(transcript[0]?.w).toBe('though')
  })
})

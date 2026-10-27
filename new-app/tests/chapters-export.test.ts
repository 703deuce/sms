import { describe, expect, it } from 'vitest'
import { descriptionWithChapters, youtubeChaptersText } from '@/lib/clips/script-editor/chapters-export'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

const doc: ScriptDocumentV1 = {
  v: 1,
  keptWordIds: [],
  deletedWordIds: [],
  markers: [{ id: 'm1', outMs: 65000, label: 'Details', exportAsChapter: true }],
}

describe('chapters export', () => {
  it('formats youtube timestamps', () => {
    expect(youtubeChaptersText(doc)).toBe('1:05 Details')
  })

  it('appends chapters to description', () => {
    const out = descriptionWithChapters(doc, 'My video')
    expect(out).toContain('Chapters:')
    expect(out).toContain('1:05 Details')
  })
})

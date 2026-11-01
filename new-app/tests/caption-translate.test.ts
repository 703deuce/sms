import { describe, expect, it } from 'vitest'
import { chunksForTranslation, linesFromTranslation } from '@/lib/clips/caption-translate'
import { defaultEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 5000, trimMinMs: 0, trimMaxMs: 5000 }

describe('caption-translate', () => {
  it('preserves timings in linesFromTranslation', () => {
    const chunks = [
      { startMs: 0, endMs: 1000, text: 'Hello' },
      { startMs: 1000, endMs: 2000, text: 'World' },
    ]
    const lines = linesFromTranslation(chunks, ['Hola', 'Mundo'])
    expect(lines).toHaveLength(2)
    expect(lines[0]?.startMs).toBe(0)
    expect(lines[1]?.endMs).toBe(2000)
    expect(lines[0]?.text).toBe('Hola')
  })

  it('keeps original when translated text empty', () => {
    const chunks = [{ startMs: 0, endMs: 500, text: 'Stay' }]
    const lines = linesFromTranslation(chunks, [''])
    expect(lines[0]?.text).toBe('Stay')
  })

  it('uses captionLines when set', () => {
    const edits = {
      ...defaultEdits(bounds),
      captionLines: [{ id: 'l1', text: 'Line', startMs: 100, endMs: 900 }],
    }
    const chunks = chunksForTranslation(edits, [])
    expect(chunks).toEqual([{ startMs: 100, endMs: 900, text: 'Line' }])
  })
})

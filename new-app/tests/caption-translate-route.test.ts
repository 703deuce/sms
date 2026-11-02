import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  chunkNumberedLines,
  mergeNumberedResponses,
  numberedInput,
  responseSchemaForCount,
} from '@/lib/clips/caption-translate-index'
import { translateCaptionLinesRobust } from '@/lib/server/clips/caption-translate-batch'

vi.mock('@/lib/server/ai/openai-json', () => ({
  openAiJsonWithGeminiFallback: vi.fn(),
}))

import { openAiJsonWithGeminiFallback } from '@/lib/server/ai/openai-json'

const mockLlm = vi.mocked(openAiJsonWithGeminiFallback)

describe('caption-translate-index', () => {
  it('chunks at 40 lines', () => {
    const items = numberedInput(Array.from({ length: 85 }, (_, i) => ({ text: `L${i}` })))
    const chunks = chunkNumberedLines(items)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(40)
    expect(chunks[2]).toHaveLength(5)
  })

  it('schema pins min and max item count', () => {
    const schema = responseSchemaForCount(34) as { properties: { lines: { minItems: number; maxItems: number } } }
    expect(schema.properties.lines.minItems).toBe(34)
    expect(schema.properties.lines.maxItems).toBe(34)
  })

  it('merge aligns by index not array position', () => {
    const merged = mergeNumberedResponses(
      [0, 1, 2],
      [
        [
          { i: 2, text: 'c' },
          { i: 0, text: 'a' },
        ],
        [{ i: 1, text: 'b' }],
      ],
    )
    expect(merged.lines).toEqual(['a', 'b', 'c'])
  })
})

describe('translateCaptionLinesRobust', () => {
  beforeEach(() => {
    mockLlm.mockReset()
  })

  it('retries batch when model merges two lines then succeeds', async () => {
    const inputs = [{ text: 'one' }, { text: 'two' }, { text: 'three' }]
    mockLlm
      .mockResolvedValueOnce({
        lines: [
          { i: 0, text: 'uno dos' },
          { i: 2, text: 'tres' },
        ],
      })
      .mockResolvedValueOnce({
        lines: [
          { i: 0, text: 'uno' },
          { i: 1, text: 'dos' },
          { i: 2, text: 'tres' },
        ],
      })

    const result = await translateCaptionLinesRobust('Spanish', inputs)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.lines).toEqual(['uno', 'dos', 'tres'])
    }
    expect(mockLlm).toHaveBeenCalledTimes(2)
  })

  it('fills missing index with per-line follow-up', async () => {
    const inputs = [{ text: 'a' }, { text: 'b' }]
    mockLlm
      .mockResolvedValueOnce({ lines: [{ i: 0, text: '甲' }] })
      .mockResolvedValueOnce({ lines: [{ i: 0, text: '甲' }] })
      .mockResolvedValueOnce({ lines: [{ i: 0, text: '乙' }] })

    const result = await translateCaptionLinesRobust('Japanese', inputs)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.lines).toEqual(['甲', '乙'])
    }
    expect(mockLlm).toHaveBeenCalledTimes(3)
  })
})

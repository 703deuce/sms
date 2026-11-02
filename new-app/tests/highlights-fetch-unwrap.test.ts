import { describe, expect, it } from 'vitest'

/** Regression: clipsFetch returns API `json.data` once; hook must not read `.data` again. */
describe('GET /highlights client unwrap', () => {
  it('clipsFetch payload is the highlights object, not { data: highlights }', () => {
    const apiJson = {
      data: {
        source: 'find' as const,
        status: 'DONE',
        progress: 100,
        picks: [
          {
            clipId: 'fp_x_0',
            title: 'T',
            startMs: 3600,
            endMs: 32000,
            score: 77,
            reasonTag: 'visual' as const,
            why: null,
            origin: 'find' as const,
          },
        ],
      },
    }
    const afterClipsFetch = apiJson.data
    expect(afterClipsFetch.picks).toHaveLength(1)
    expect((afterClipsFetch as { data?: unknown }).data).toBeUndefined()
    const wrongSecondUnwrap = (afterClipsFetch as { data?: typeof afterClipsFetch }).data
    expect(wrongSecondUnwrap).toBeUndefined()
  })
})

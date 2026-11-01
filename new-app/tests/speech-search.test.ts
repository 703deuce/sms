import { describe, expect, it } from 'vitest'
import { searchSpeech, type SpeechSource } from '@/lib/clips/editor/speech-search'

const sources: SpeechSource[] = [
  {
    id: 'main',
    kind: 'main',
    label: 'Main',
    words: [
      { w: 'Hello', s: 0, e: 0.5 },
      { w: 'world', s: 0.5, e: 1 },
      { w: 'again', s: 2, e: 2.4 },
    ],
  },
  {
    id: 'upload:u1',
    kind: 'upload',
    label: 'B-roll',
    words: [
      { w: 'Hello', s: 0, e: 0.4 },
      { w: 'there', s: 0.4, e: 0.9 },
    ],
  },
]

describe('searchSpeech', () => {
  it('matches phrase across sources in source order then time', () => {
    const hits = searchSpeech(sources, 'hello world')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.sourceId).toBe('main')
    expect(hits[0]?.snippet.toLowerCase()).toContain('hello')
  })

  it('is case and punctuation insensitive', () => {
    const hits = searchSpeech(sources, 'HELLO, there!')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.sourceId).toBe('upload:u1')
  })

  it('respects limit and returns empty when no hit', () => {
    expect(searchSpeech(sources, 'missing phrase')).toEqual([])
    const many = searchSpeech(
      [
        {
          id: 'main',
          kind: 'main',
          label: 'M',
          words: Array.from({ length: 20 }, (_, i) => ({ w: 'word', s: i, e: i + 0.2 })),
        },
      ],
      'word word',
      { limit: 2 },
    )
    expect(many.length).toBeLessThanOrEqual(2)
  })

  it('bounds snippet with ellipsis', () => {
    const long: SpeechSource[] = [
      {
        id: 'main',
        kind: 'main',
        label: 'M',
        words: Array.from({ length: 30 }, (_, i) => ({ w: `w${i}`, s: i, e: i + 0.1 })),
      },
    ]
    const hits = searchSpeech(long, 'w10 w11')
    expect(hits[0]?.snippet.startsWith('…')).toBe(true)
  })
})

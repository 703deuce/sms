import { describe, expect, it } from 'vitest'
import { vocabularyToAsrKeyterms } from '@/lib/clips/asr-keyterms'

describe('vocabularyToAsrKeyterms', () => {
  it('uses corrected to-spelling and dedupes', () => {
    const terms = vocabularyToAsrKeyterms([
      { from: 'jaylen', to: 'Jalen' },
      { from: 'rodgers', to: 'Rodgers' },
      { from: 'Jaylen', to: 'Jalen' },
    ])
    expect(terms).toEqual(['Jalen', 'Rodgers'])
  })
})

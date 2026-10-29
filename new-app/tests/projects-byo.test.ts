import { describe, expect, it } from 'vitest'
import { assertByoUploadDuration, BYO_DURATION_ERROR } from '@/lib/clips/byo-project'

describe('BYO project duration guard', () => {
  it('rejects uploads longer than 3 minutes', () => {
    expect(() => assertByoUploadDuration(181_000)).toThrow(BYO_DURATION_ERROR)
  })

  it('allows uploads within limit', () => {
    expect(() => assertByoUploadDuration(180_000)).not.toThrow()
    expect(() => assertByoUploadDuration(30_000)).not.toThrow()
  })
})

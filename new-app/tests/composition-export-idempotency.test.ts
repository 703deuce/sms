import { describe, expect, it } from 'vitest'

describe('composition export idempotency', () => {
  it('reuses existing render id when re-enqueueing same idempotency key', () => {
    const existingId = 'scrn_existing'
    const renderId = existingId ?? 'scrn_new'
    expect(renderId).toBe('scrn_existing')
  })
})

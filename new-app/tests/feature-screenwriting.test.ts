import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { isScreenwritingEnabled } from '@/lib/features/screenwriting'

describe('FEATURE_SCREENWRITING', () => {
  const prev = process.env.FEATURE_SCREENWRITING

  afterEach(() => {
    process.env.FEATURE_SCREENWRITING = prev
  })

  beforeEach(() => {
    delete process.env.FEATURE_SCREENWRITING
    delete process.env.NEXT_PUBLIC_FEATURE_SCREENWRITING
  })

  it('defaults off', () => {
    expect(isScreenwritingEnabled()).toBe(false)
  })

  it('enables on 1', () => {
    process.env.FEATURE_SCREENWRITING = '1'
    expect(isScreenwritingEnabled()).toBe(true)
  })
})

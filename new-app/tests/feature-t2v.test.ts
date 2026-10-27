import { afterEach, describe, expect, it } from 'vitest'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'

describe('FEATURE_T2V', () => {
  const prev = process.env.FEATURE_T2V
  const prevPublic = process.env.NEXT_PUBLIC_FEATURE_T2V

  afterEach(() => {
    process.env.FEATURE_T2V = prev
    process.env.NEXT_PUBLIC_FEATURE_T2V = prevPublic
  })

  it('is off by default', () => {
    delete process.env.FEATURE_T2V
    delete process.env.NEXT_PUBLIC_FEATURE_T2V
    expect(isT2vFeatureEnabled()).toBe(false)
  })

  it('is on when FEATURE_T2V=1', () => {
    process.env.FEATURE_T2V = '1'
    expect(isT2vFeatureEnabled()).toBe(true)
  })
})

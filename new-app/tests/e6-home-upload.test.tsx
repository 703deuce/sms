// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { partTimeoutMs } from '@/lib/clips/upload'

describe('E6 upload part deadline', () => {
  it('never shorter than 2 minutes and scales with part size', () => {
    expect(partTimeoutMs(1024)).toBe(120_000)
    expect(partTimeoutMs(32 * 1024 * 1024)).toBe(512_000)
  })
})

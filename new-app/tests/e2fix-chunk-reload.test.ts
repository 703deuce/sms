import { describe, expect, it } from 'vitest'
import { CHUNK_RELOAD_COOLDOWN_MS, shouldReloadForChunkError } from '@/components/chunk-load-recovery'

describe('E2fix: chunk-load recovery guard', () => {
  it('reloads when never reloaded, for the legacy "1" flag, and after the cooldown; not inside it', () => {
    const now = 1_800_000_000_000
    expect(shouldReloadForChunkError(null, now)).toBe(true)
    expect(shouldReloadForChunkError('1', now)).toBe(true)
    expect(shouldReloadForChunkError(String(now - 5_000), now)).toBe(false)
    expect(shouldReloadForChunkError(String(now - CHUNK_RELOAD_COOLDOWN_MS - 1), now)).toBe(true)
  })
})

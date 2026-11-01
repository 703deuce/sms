import { describe, expect, it } from 'vitest'
import { shouldReloadForChunkError, shouldReloadForChunkFailure } from '@/lib/clips/editor/editor-reload-paths'

describe('editor reload paths (409/502 do not hard-reload)', () => {
  it('rejects API URLs and bare 502 messages (transient gateway HTML)', () => {
    expect(shouldReloadForChunkFailure('https://transovo.ai/api/clips/x', 'Failed to load')).toBe(false)
    expect(shouldReloadForChunkFailure('', '502 Bad Gateway')).toBe(false)
  })

  it('allows stale Next chunk static assets and ChunkLoadError', () => {
    expect(shouldReloadForChunkFailure('/_next/static/chunks/app.js', 'Script error')).toBe(true)
    expect(shouldReloadForChunkFailure('', 'ChunkLoadError: Loading chunk 12 failed')).toBe(true)
  })

  it('cooldown prevents reload loops', () => {
    const now = 1_700_000_000_000
    expect(shouldReloadForChunkError(null, now)).toBe(true)
    expect(shouldReloadForChunkError(String(now - 1000), now)).toBe(false)
    expect(shouldReloadForChunkError(String(now - 61_000), now)).toBe(true)
  })
})

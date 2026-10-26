import { describe, expect, it } from 'vitest'
import { createStreamerOAuthState, verifyStreamerOAuthState } from '@/lib/server/streamer/oauth-state'

describe('streamer oauth state', () => {
  it('round trips', () => {
    process.env.WORKER_SHARED_SECRET = 'unit-test-secret'
    const raw = createStreamerOAuthState('ws_test')
    const parsed = verifyStreamerOAuthState(raw)
    expect(parsed.workspaceId).toBe('ws_test')
  })

  it('rejects tamper', () => {
    process.env.WORKER_SHARED_SECRET = 'unit-test-secret'
    const raw = createStreamerOAuthState('ws_test')
    const tampered = raw.slice(0, -4) + 'xxxx'
    expect(() => verifyStreamerOAuthState(tampered)).toThrow()
  })
})

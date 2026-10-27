import { describe, expect, it } from 'vitest'
import { hashInviteToken, mintInviteToken } from '@/lib/server/recording/invites'

describe('recording invites', () => {
  it('hashes tokens deterministically', () => {
    const t = 'abc'
    expect(hashInviteToken(t)).toBe(hashInviteToken(t))
    expect(hashInviteToken(t)).not.toBe(hashInviteToken('def'))
  })

  it('mints url-safe tokens', () => {
    const t = mintInviteToken()
    expect(t.length).toBeGreaterThan(20)
    expect(t).not.toMatch(/[+/=]/)
  })
})

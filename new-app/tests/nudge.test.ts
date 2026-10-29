import { describe, expect, it } from 'vitest'
import { nudgeTrimIn, nudgeTrimOut } from '@/lib/clips/editor/nudge'

describe('nudge trim', () => {
  const limits = { clipStartMs: 10_000, clipEndMs: 20_000, trimMinMs: 8000, trimMaxMs: 22_000 }

  it('nudges in without crossing out', () => {
    const next = nudgeTrimIn({ in: 10_000, out: 18_000 }, 200, limits)
    expect(next.in).toBe(10_200)
    expect(next.out).toBe(18_000)
  })

  it('nudges out within media max', () => {
    const next = nudgeTrimOut({ in: 10_000, out: 18_000 }, 500, limits)
    expect(next.out).toBe(18_500)
  })
})

import { describe, expect, it } from 'vitest'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'

describe('T6 signals defaults', () => {
  it('returns conservative defaults when aiMeta has no signals', () => {
    const s = signalsOrDefaults({ clipType: 'irl' })
    expect(s.clip_type).toBe('irl')
    expect(s.background_action).toBe(true)
    expect(s.v).toBe(1)
  })
})

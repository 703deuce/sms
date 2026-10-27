import { describe, expect, it } from 'vitest'
import { brandEditsFromProjectBrand } from '@/lib/clips/brand'

describe('brandEditsFromProjectBrand', () => {
  it('includes intro/outro keys when present', () => {
    const b = brandEditsFromProjectBrand({
      templateId: 't1',
      logoKey: 'logo.png',
      introVideoKey: 'intro.mp4',
      outroVideoKey: 'outro.mp4',
    })
    expect(b?.useIntro).toBe(true)
    expect(b?.introVideoKey).toBe('intro.mp4')
  })
})

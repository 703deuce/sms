import { describe, expect, it } from 'vitest'
import { shouldClientEnrichReadyClips } from '@/lib/clips/project-clips-enrich'

describe('project clips client enrich', () => {
  it('enriches when READY SSR list skipped transcript fields', () => {
    expect(shouldClientEnrichReadyClips('READY', [{ id: 'c1' }])).toBe(true)
    expect(shouldClientEnrichReadyClips('READY', [])).toBe(false)
    expect(shouldClientEnrichReadyClips('QUEUED', [{ id: 'c1' }])).toBe(false)
    expect(shouldClientEnrichReadyClips('READY', null)).toBe(false)
  })
})

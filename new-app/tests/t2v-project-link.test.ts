// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
import { t2vProjectHref, t2vStatusLabel } from '../lib/t2v/project-link'

describe('t2vProjectHref', () => {
  it('routes clip projects to clips view', () => {
    expect(t2vProjectHref({ id: 'p1', sourceKind: 'upload' as const, status: 'READY' as const })).toBe('/app/clips/p1')
  })

  it('routes draft t2v to studio', () => {
    expect(
      t2vProjectHref({ id: 'p2', sourceKind: 't2v' as const, status: 'DRAFT' as const, t2vDraftStatus: 'DRAFT' as const }),
    ).toBe('/app/ai-video/p2')
  })

  it('routes ready t2v to script editor', () => {
    expect(
      t2vProjectHref({ id: 'p3', sourceKind: 't2v' as const, status: 'READY' as const, t2vDraftStatus: 'READY' as const }),
    ).toBe('/app/video-editor/p3/script')
  })
})

describe('t2vStatusLabel', () => {
  it('returns null for non-t2v', () => {
    expect(t2vStatusLabel({ sourceKind: 'upload' as const, status: 'READY' as const })).toBeNull()
  })

  it('shows building progress', () => {
    expect(
      t2vStatusLabel({
        sourceKind: 't2v' as const,
        status: 'DRAFT' as const,
        t2vDraftStatus: 'ASSEMBLING' as const,
        t2vDraftProgress: 62,
      }),
    ).toBe('Building 62%')
  })
})

import { describe, expect, it } from 'vitest'
import { t2vProjectHref, t2vStatusLabel } from '@/lib/t2v/project-link'

describe('t2vProjectHref', () => {
  it('routes clip projects to clips view', () => {
    expect(t2vProjectHref({ id: 'p1', sourceKind: 'upload', status: 'READY' })).toBe('/app/clips/p1')
  })

  it('routes draft t2v to studio', () => {
    expect(
      t2vProjectHref({ id: 'p2', sourceKind: 't2v', status: 'DRAFT', t2vDraftStatus: 'DRAFT' }),
    ).toBe('/app/clips/p2/video')
  })

  it('routes ready t2v to script editor', () => {
    expect(
      t2vProjectHref({ id: 'p3', sourceKind: 't2v', status: 'READY', t2vDraftStatus: 'READY' }),
    ).toBe('/app/clips/p3/script')
  })
})

describe('t2vStatusLabel', () => {
  it('returns null for non-t2v', () => {
    expect(t2vStatusLabel({ sourceKind: 'upload', status: 'READY' })).toBeNull()
  })

  it('shows building progress', () => {
    expect(
      t2vStatusLabel({
        sourceKind: 't2v',
        status: 'DRAFT',
        t2vDraftStatus: 'ASSEMBLING',
        t2vDraftProgress: 62,
      }),
    ).toBe('Building 62%')
  })
})

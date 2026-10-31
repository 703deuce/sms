import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/db', () => ({ getPrisma: () => ({}) }))
vi.mock('@/lib/server/clips/jobs', () => ({ shouldTouchLockedAt: () => false }))
vi.mock('@/lib/clips/user-facing-job-error', () => ({ sanitizeClipProjectErrorForUser: (s: string) => s }))

import { mergeWatchdogSnap } from '@/lib/clips/clipper-watchdog'
import { isStaleWorkerPost } from '@/lib/server/clips/job-progress'
import {
  formatEtaShort,
  formatExportProgressLine,
  readRenderDetail,
} from '@/lib/clips/editor/export-progress-text'

describe('FV4a watchdog activity', () => {
  const t0 = Date.parse('2026-10-31T17:35:00Z')
  it('an activity change at the same % counts as progress', () => {
    const a = mergeWatchdogSnap(undefined, 'render_clip', 74, t0, '1:10.0:120:3')
    const b = mergeWatchdogSnap(a, 'render_clip', 74, t0 + 600_000, '1:95.5:410:61')
    expect(b.lastChangeAt).toBe(new Date(t0 + 600_000).toISOString())
    expect(b.activity).toBe('1:95.5:410:61')
  })
  it('same activity and same % keeps lastChangeAt (stall still detected)', () => {
    const a = mergeWatchdogSnap(undefined, 'render_clip', 74, t0, 'x')
    const b = mergeWatchdogSnap(a, 'render_clip', 74, t0 + 600_000, 'x')
    expect(b.lastChangeAt).toBe(a.lastChangeAt)
  })
  it('posts without activity behave as before', () => {
    const a = mergeWatchdogSnap(undefined, 'render_clip', 74, t0)
    const b = mergeWatchdogSnap(a, 'render_clip', 74, t0 + 600_000)
    expect(b.lastChangeAt).toBe(a.lastChangeAt)
    const c = mergeWatchdogSnap(b, 'render_clip', 75, t0 + 700_000)
    expect(c.lastChangeAt).toBe(new Date(t0 + 700_000).toISOString())
  })
})

describe('FV4a isStaleWorkerPost', () => {
  it('ignores a post from a slot that no longer holds the lock', () => {
    expect(isStaleWorkerPost({ status: 'RUNNING', lockedBy: 'w:s1' }, { workerId: 'w:s0', progress: 74 })).toBe(true)
  })
  it('accepts the lock holder', () => {
    expect(isStaleWorkerPost({ status: 'RUNNING', lockedBy: 'w:s1' }, { workerId: 'w:s1', progress: 74 })).toBe(false)
  })
  it('a requeued job is not resurrected by an orphan post', () => {
    expect(isStaleWorkerPost({ status: 'QUEUED', lockedBy: null }, { progress: 74 })).toBe(true)
    expect(isStaleWorkerPost({ status: 'QUEUED', lockedBy: null }, { jobStatus: 'FAILED' })).toBe(true)
  })
  it('old workers without workerId still work on RUNNING jobs', () => {
    expect(isStaleWorkerPost({ status: 'RUNNING', lockedBy: 'w:s1' }, { progress: 74 })).toBe(false)
  })
})

describe('FV4a export status line', () => {
  it('formats ETAs', () => {
    expect(formatEtaShort(null)).toBeNull()
    expect(formatEtaShort(0)).toBeNull()
    // FV4b: rounded text
    expect(formatEtaShort(16)).toBe('less than a minute left')
    expect(formatEtaShort(840)).toBe('about 15 min left')
    expect(formatEtaShort(7800)).toBe('about 2 h 10 min left')
    expect(formatEtaShort(7200)).toBe('about 2 h left')
  })
  it('shows step and real ETA', () => {
    expect(
      formatExportProgressLine({
        status: 'RENDERING',
        progress: 63,
        phase: 'render_clip',
        etaSec: 840,
        detail: { step: 2, steps: 4, stepPct: 41 },
      }),
    ).toBe('Rendering export… 63% · step 2 of ~4 (41%) · about 15 min left')
  })
  it('falls back to phase when no detail', () => {
    expect(
      formatExportProgressLine({ status: 'RENDERING', progress: 90, phase: 'upload_output', etaSec: null }),
    ).toBe('Rendering export… 90% (upload output)')
    expect(formatExportProgressLine({ status: 'QUEUED', progress: null, phase: null, etaSec: null })).toBe(
      'Queued for rendering…',
    )
  })
  it('reads render detail defensively', () => {
    expect(readRenderDetail(null)).toBeNull()
    expect(readRenderDetail({ step: '1', steps: 3 })).toBeNull()
    expect(readRenderDetail({ step: 1, steps: 3 })).toEqual({ step: 1, steps: 3, stepPct: null })
    expect(readRenderDetail({ step: 2, steps: 3, stepPct: 50 })).toEqual({ step: 2, steps: 3, stepPct: 50 })
  })
})

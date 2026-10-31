import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  render: null as Record<string, unknown> | null,
  job: null as { id: string } | null,
  renderArgs: [] as unknown[],
  jobArgs: [] as unknown[],
}))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipRender: {
      findFirst: async (args: unknown) => {
        db.renderArgs.push(args)
        return db.render
      },
    },
    clipJob: {
      findFirst: async (args: unknown) => {
        db.jobArgs.push(args)
        return db.job
      },
    },
  }),
}))
vi.mock('@/lib/storage', () => ({ getClipStorage: () => ({}) }))
vi.mock('@/lib/storage/signed-download-cache', () => ({ createCachedSignedDownloadUrl: async () => 'x' }))
vi.mock('@/lib/server/clips/clips', () => ({ exportFilename: (t: string) => `${t}.mp4` }))
vi.mock('@/lib/server/clips/export-rows', () => ({}))
vi.mock('@/lib/clips/compose-spec', () => ({ resolveComposeSpec: () => null }))
vi.mock('@/lib/clips/compose-spec-flags', () => ({ composeSpecV1Enabled: () => false }))
vi.mock('@/lib/clips/edits', () => ({ editsVersionHash: () => 'h' }))
vi.mock('@/lib/clips/export-aspect', () => ({ exportPixelSize: () => ({ width: 1, height: 1 }), renderVersionHash: () => 'h' }))
vi.mock('@/lib/supabase/id', () => ({ createId: (p: string) => `${p}_new` }))

import {
  ETA_MIN_PROGRESS,
  formatEtaShort,
  formatExportProgressLine,
  isRenderInFlight,
  monotonicPct,
} from '@/lib/clips/editor/export-progress-text'
import { findInFlightRender, IN_FLIGHT_RENDER_MAX_AGE_MS } from '@/lib/server/clips/renders'

describe('FV4b monotonic %', () => {
  it('never goes down for the same render', () => {
    let p: number | null = null
    for (const n of [5, 2, 6, 10, 55, 41, 63, 90, 82, 95, 100]) p = monotonicPct(p, n)
    expect(p).toBe(100)
    expect(monotonicPct(63, 58)).toBe(63)
    expect(monotonicPct(null, 2)).toBe(2)
    expect(monotonicPct(40, null)).toBe(40)
    expect(monotonicPct(40, Number.NaN)).toBe(40)
    expect(monotonicPct(null, 140)).toBe(100)
  })
})

describe('FV4b stable ETA text', () => {
  it('rounds calmly', () => {
    expect(formatEtaShort(45)).toBe('less than a minute left')
    expect(formatEtaShort(75)).toBe('about 1 min left')
    expect(formatEtaShort(130)).toBe('about 2 min left')
    expect(formatEtaShort(590)).toBe('about 10 min left')
    expect(formatEtaShort(610)).toBe('about 10 min left')
    expect(formatEtaShort(720)).toBe('about 10 min left')
    expect(formatEtaShort(760)).toBe('about 15 min left')
    expect(formatEtaShort(3500)).toBe('about 1 h left')
    expect(formatEtaShort(5400)).toBe('about 1 h 30 min left')
  })
  it('hides the ETA during prep (< 10 %)', () => {
    expect(ETA_MIN_PROGRESS).toBe(10)
    expect(formatExportProgressLine({ status: 'RENDERING', progress: 6, phase: 'render_clip', etaSec: 120 })).toBe(
      'Rendering export… 6%',
    )
    expect(formatExportProgressLine({ status: 'RENDERING', progress: 34, phase: 'render_clip', etaSec: 600 })).toBe(
      'Rendering export… 34% · about 10 min left',
    )
  })
})

describe('FV4b render in flight', () => {
  it('only QUEUED / RUNNING / RENDERING of a known render', () => {
    expect(isRenderInFlight(null, 'RENDERING')).toBe(false)
    expect(isRenderInFlight('rnd_1', 'QUEUED')).toBe(true)
    expect(isRenderInFlight('rnd_1', 'RUNNING')).toBe(true)
    expect(isRenderInFlight('rnd_1', 'RENDERING')).toBe(true)
    expect(isRenderInFlight('rnd_1', 'READY')).toBe(false)
    expect(isRenderInFlight('rnd_1', 'FAILED')).toBe(false)
    expect(isRenderInFlight('rnd_1', 'EXPIRED')).toBe(false)
    expect(isRenderInFlight('rnd_1', null)).toBe(false)
  })
})

describe('FV4b findInFlightRender', () => {
  beforeEach(() => {
    db.render = null
    db.job = null
    db.renderArgs = []
    db.jobArgs = []
  })
  it('returns the live render with the same edits hash', async () => {
    db.render = { id: 'rnd_a', status: 'RENDERING', filename: 'f.mp4' }
    db.job = { id: 'job_a' }
    const now = Date.parse('2026-10-31T19:00:00Z')
    const r = await findInFlightRender('ws_1', 'clip_1', 'hash1', now)
    expect(r).toEqual({ render: db.render, jobId: 'job_a' })
    const where = (db.renderArgs[0] as { where: Record<string, unknown> }).where
    expect(where).toMatchObject({ clipId: 'clip_1', workspaceId: 'ws_1', editsVersionHash: 'hash1', status: { in: ['QUEUED', 'RENDERING'] } })
    expect((where.createdAt as { gte: Date }).gte.getTime()).toBe(now - IN_FLIGHT_RENDER_MAX_AGE_MS)
    const jw = (db.jobArgs[0] as { where: Record<string, unknown> }).where
    expect(jw).toMatchObject({ type: 'RENDER_CLIP', status: { in: ['QUEUED', 'RUNNING'] }, payload: { path: ['renderId'], equals: 'rnd_a' } })
  })
  it('ignores a QUEUED / RENDERING row whose job is gone', async () => {
    db.render = { id: 'rnd_dead', status: 'RENDERING' }
    db.job = null
    expect(await findInFlightRender('ws_1', 'clip_1', 'hash1')).toBeNull()
  })
  it('nothing in flight', async () => {
    expect(await findInFlightRender('ws_1', 'clip_1', 'hash1')).toBeNull()
    expect(db.jobArgs).toHaveLength(0)
  })
})

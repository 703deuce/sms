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
vi.mock('@/lib/server/workspace', () => ({ resolveWorkspaceId: async () => 'ws_1' }))
// renders.ts imports these for enqueueRenderClip only; not needed for the lookup under test.
vi.mock('@/lib/clips/edits', () => ({ editsVersionHash: () => 'h' }))
vi.mock('@/lib/clips/export-aspect', () => ({ exportPixelSize: () => ({ width: 1, height: 1 }), renderVersionHash: () => 'h' }))

import { activeRenderToResume, isRenderInFlight } from '@/lib/clips/editor/export-progress-text'
import { findActiveRenderForClip, IN_FLIGHT_RENDER_MAX_AGE_MS } from '@/lib/server/clips/renders'
import { GET } from '@/app/api/clips/clips/[id]/active-render/route'

beforeEach(() => {
  db.render = null
  db.job = null
  db.renderArgs = []
  db.jobArgs = []
})

describe('FV4c activeRenderToResume', () => {
  it('resumes a QUEUED / RENDERING render', () => {
    expect(activeRenderToResume({ render: { id: 'rnd_1', status: 'RENDERING' } })).toEqual({
      renderId: 'rnd_1',
      status: 'RENDERING',
      resolution: null,
      aspectRatio: null,
    })
    expect(activeRenderToResume({ render: { id: 'rnd_2', status: 'QUEUED' } })?.status).toBe('QUEUED')
    expect(isRenderInFlight('rnd_1', 'RENDERING')).toBe(true)
  })
  it('ignores null / malformed / terminal rows', () => {
    expect(activeRenderToResume(null)).toBeNull()
    expect(activeRenderToResume({ render: null })).toBeNull()
    expect(activeRenderToResume({ channels: [] })).toBeNull()
    expect(activeRenderToResume({ render: { id: '', status: 'RENDERING' } })).toBeNull()
    expect(activeRenderToResume({ render: { id: 'rnd_1', status: 'READY' } })).toBeNull()
    expect(activeRenderToResume({ render: { id: 'rnd_1', status: 'FAILED' } })).toBeNull()
  })
})

describe('FV4c findActiveRenderForClip', () => {
  it('returns the newest in-flight render of the clip (any edits hash) with a live job', async () => {
    db.render = { id: 'rnd_live', status: 'RENDERING', clipId: 'clip_1' }
    db.job = { id: 'job_live' }
    const now = Date.UTC(2026, 9, 31, 19, 40)
    const res = await findActiveRenderForClip('ws_1', 'clip_1', now)
    expect(res).toEqual({ render: db.render, jobId: 'job_live' })
    const rArgs = db.renderArgs[0] as { where: Record<string, unknown>; orderBy: unknown }
    expect(rArgs.where.clipId).toBe('clip_1')
    expect(rArgs.where.workspaceId).toBe('ws_1')
    expect(rArgs.where.status).toEqual({ in: ['QUEUED', 'RENDERING'] })
    expect(rArgs.where.editsVersionHash).toBeUndefined()
    expect((rArgs.where.createdAt as { gte: Date }).gte.getTime()).toBe(now - IN_FLIGHT_RENDER_MAX_AGE_MS)
    expect(rArgs.orderBy).toEqual({ createdAt: 'desc' })
    const jArgs = db.jobArgs[0] as { where: Record<string, unknown> }
    expect(jArgs.where.type).toBe('RENDER_CLIP')
    expect(jArgs.where.status).toEqual({ in: ['QUEUED', 'RUNNING'] })
    expect(jArgs.where.payload).toEqual({ path: ['renderId'], equals: 'rnd_live' })
  })
  it('returns null when no row, or the row has no live job (crashed / stale)', async () => {
    expect(await findActiveRenderForClip('ws_1', 'clip_1')).toBeNull()
    db.render = { id: 'rnd_dead', status: 'RENDERING' }
    db.job = null
    expect(await findActiveRenderForClip('ws_1', 'clip_1')).toBeNull()
  })
})

describe('FV4c GET /api/clips/clips/[id]/active-render', () => {
  const call = async () => {
    const res = await GET(new Request('http://x/api/clips/clips/clip_1/active-render'), {
      params: Promise.resolve({ id: 'clip_1' }),
    })
    return (await res.json()) as { data: { render: Record<string, unknown> | null } }
  }
  it('returns the in-flight render (no cost / money fields)', async () => {
    db.render = {
      id: 'rnd_live',
      status: 'RENDERING',
      resolution: '1080p',
      aspectRatio: '16:9',
      createdAt: new Date('2026-10-31T19:33:00Z'),
      outputKey: null,
    }
    db.job = { id: 'job_live' }
    const body = await call()
    expect(body.data.render).toEqual({
      id: 'rnd_live',
      status: 'RENDERING',
      resolution: '1080p',
      aspectRatio: '16:9',
      createdAt: '2026-10-31T19:33:00.000Z',
    })
    expect(JSON.stringify(body)).not.toMatch(/\$|cost|usd/i)
  })
  it('returns render: null when nothing is in flight', async () => {
    const body = await call()
    expect(body.data.render).toBeNull()
  })
})

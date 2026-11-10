import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdProductInput } from '@/lib/ad-studio/types'

type DbRow = Record<string, any>
const state = vi.hoisted(() => ({
  runs: new Map<string, DbRow>(),
  scenes: new Map<string, DbRow>(),
  search: vi.fn(async () => [{ providerId: 'pixabay-fixture', durationS: 40, width: 1080, height: 1920, tags: 'work' }]),
  cached: vi.fn(async () => ({ providerId: 'pixabay-fixture', durationS: 40, width: 1080, height: 1920, tags: 'work' })),
  ensure: vi.fn(async () => ({ asset: { id: 'stock_01' }, url: 'https://invalid.example/signed' })),
}))

const sameStatus = (row: DbRow, where: DbRow): boolean => {
  if (!where.status) return true
  if (typeof where.status === 'string') return row.status === where.status
  if (where.status.in) return where.status.in.includes(row.status)
  if (where.status.notIn) return !where.status.notIn.includes(row.status)
  return true
}
const apply = (row: DbRow, data: DbRow) => {
  Object.assign(row, data, { updatedAt: new Date() })
  return row
}
const fakeDb = {
  adStudioRun: {
    async findFirst({ where }: { where: DbRow }) {
      return [...state.runs.values()].find(row => row.id === where.id && row.workspaceId === where.workspaceId) ?? null
    },
    async findUnique({ where }: { where: DbRow }) {
      if (where.workspaceId_idempotencyKey) {
        const key = where.workspaceId_idempotencyKey
        return [...state.runs.values()].find(row => row.workspaceId === key.workspaceId && row.idempotencyKey === key.idempotencyKey) ?? null
      }
      return state.runs.get(where.id) ?? null
    },
    async count({ where }: { where: DbRow }) {
      return [...state.runs.values()].filter(row => row.workspaceId === where.workspaceId && sameStatus(row, where)).length
    },
    async create({ data }: { data: DbRow }) {
      const now = new Date()
      const row = { ...data, plan: data.plan || null, creditEstimate: data.creditEstimate ?? null,
        creditCharged: data.creditCharged ?? null, projectId: null, clipId: null,
        errorCode: null, errorMessage: null, completedAt: null,
        createdAt: now, updatedAt: now }
      state.runs.set(row.id, row)
      return row
    },
    async updateMany({ where, data }: { where: DbRow; data: DbRow }) {
      const rows = [...state.runs.values()].filter(row =>
        row.id === where.id && row.workspaceId === where.workspaceId && sameStatus(row, where))
      rows.forEach(row => apply(row, data))
      return { count: rows.length }
    },
    async update({ where, data }: { where: DbRow; data: DbRow }) {
      const row = state.runs.get(where.id)
      if (!row) throw new Error('missing row')
      return apply(row, data)
    },
    async findMany() { return [] },
  },
  adStudioScene: {
    async deleteMany({ where }: { where: DbRow }) {
      for (const [id, scene] of state.scenes) if (scene.runId === where.runId) state.scenes.delete(id)
    },
    async create({ data }: { data: DbRow }) {
      state.scenes.set(data.id, { ...data })
      return data
    },
    async updateMany({ where, data }: { where: DbRow; data: DbRow }) {
      let count = 0
      for (const scene of state.scenes.values()) {
        if (scene.runId === where.runId && scene.index === where.index) {
          Object.assign(scene, data)
          count++
        }
      }
      return { count }
    },
  },
  aiStudioAsset: { async count({ where }: { where: DbRow }) {
    return where.id.in.filter((id: string) => id === 'stast_owned').length
  } },
  async $transaction<T>(callback: (db: any) => Promise<T>) { return callback(fakeDb) },
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({ getPrisma: () => fakeDb }))
vi.mock('@/lib/server/ai/pixabay', () => ({
  searchVideos: state.search, findCachedHit: state.cached, ensureStockAsset: state.ensure,
}))
vi.mock('@/lib/server/ad-studio/pipeline', () => ({
  advanceAdStudioRun: vi.fn(async () => {}),
  getAdStudioImages: vi.fn(async () => []),
}))
vi.mock('@/lib/server/ad-studio/storyline', async () => {
  const { writeAdStoryline } = await import('@/lib/ad-studio/storyline-agent')
  return { writeGroundedAdStoryline: async (input: AdProductInput, mode: 'storyline' | 'image_to_ad') =>
    writeAdStoryline(input, mode) }
})

import { cancelAdRun, confirmAdRun, createAdRun, getAdRun, replanAdRun } from '@/lib/server/ad-studio/service'
const input: AdProductInput = {
  name: 'Aurora Lamp', sellingPoints: ['Adjustable warmth', 'Rechargeable battery'],
  aspect: '9:16', durationSec: 15, imageAssetIds: ['stast_owned'],
}

beforeEach(() => {
  state.runs.clear()
  state.scenes.clear()
  state.search.mockClear()
  state.cached.mockClear()
  state.ensure.mockClear()
})

describe('Ad Studio B2 service', () => {
  it('creates a planned run without generating or charging, and replays a duplicate key', async () => {
    const body = { mode: 'storyline' as const, input, idempotencyKey: 'create-001234' }
    const first = await createAdRun('ws_owner', 'user_1', body)
    expect(first.created).toBe(true)
    expect(first.run.status).toBe('plan_ready')
    expect(first.run.creditCharged).toBeNull()
    expect(first.run.plan?.scenes.length).toBeGreaterThan(0)
    expect([...state.scenes.values()].every(scene => scene.status === 'planned')).toBe(true)
    expect(state.ensure).not.toHaveBeenCalled()
    const existing = state.runs.get(first.run.id)!
    // Postgres JSONB may return fields reordered; same semantic brief must still replay.
    existing.input = Object.fromEntries(Object.entries(existing.input).reverse())
    const replay = await createAdRun('ws_owner', 'user_1', body)
    expect(replay.created).toBe(false)
    expect(replay.run.id).toBe(first.run.id)
    expect(state.runs.size).toBe(1)
    await expect(createAdRun('ws_owner','user_1',{
      ...body, input: { ...input, name: 'Different lamp' },
    })).rejects.toMatchObject({ code: 'INVALID_PARAMS', status: 409 })
    await expect(getAdRun('another_workspace', first.run.id)).rejects.toMatchObject({
      code: 'RUN_NOT_FOUND', status: 404,
    })
  })

  it('guards confirmation until the plan is ready, then enforces exact-key idempotency', async () => {
    const created = await createAdRun('ws_owner','user_1',{
      mode: 'storyline', input, idempotencyKey: 'create-002345',
    })
    const row = state.runs.get(created.run.id)!
    row.status = 'planning'
    await expect(confirmAdRun('ws_owner', row.id, 'confirm-111')).rejects.toMatchObject({
      code: 'PLAN_NOT_READY', status: 409,
    })
    row.status = 'plan_ready'
    const confirmed = await confirmAdRun('ws_owner',row.id,'confirm-111')
    expect(confirmed.status).toBe('generating')
    expect(confirmed.creditCharged).toBeNull()
    expect(confirmed.plan).not.toHaveProperty('_confirmKey')
    expect(state.ensure).toHaveBeenCalled()
    expect((await confirmAdRun('ws_owner',row.id,'confirm-111')).status).toBe('generating')
    expect(state.ensure).toHaveBeenCalledTimes(2)
    await expect(confirmAdRun('ws_owner',row.id,'confirm-222')).rejects.toMatchObject({
      code: 'ALREADY_CONFIRMED', status: 409,
    })
  })

  it('replans without invoking stock materialization or paid generations', async () => {
    const { run } = await createAdRun('ws_owner','user_1',{
      mode: 'storyline', input, idempotencyKey: 'create-003456',
    })
    const planned = await replanAdRun('ws_owner',run.id,{ sellingPoints: ['Dimmable light'] })
    expect(planned.status).toBe('plan_ready')
    expect(planned.plan?.script.solution).toContain('Dimmable light')
    expect(state.ensure).not.toHaveBeenCalled()
    const cancelled = await cancelAdRun('ws_owner',run.id)
    expect(cancelled.status).toBe('cancelled')
    await expect(confirmAdRun('ws_owner',run.id,'confirm-after-cancel')).rejects.toMatchObject({
      code: 'ALREADY_CONFIRMED',
    })
  })
})

import { StudioError } from './errors'
import type { StudioAssetRecord, StudioJobRecord, StudioJobStatus } from './types'

export type StudioListQuery = {
  limit: number
  cursor?: string | null
  status?: StudioJobStatus
  modelId?: string
  projectId?: string
}

export type StudioJobCreateRow = Omit<StudioJobRecord, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date
  updatedAt?: Date
}

export type StudioStore = {
  createJob: (row: StudioJobCreateRow) => Promise<StudioJobRecord>
  getJob: (workspaceId: string, id: string) => Promise<StudioJobRecord | null>
  getJobById: (id: string) => Promise<StudioJobRecord | null>
  listJobs: (workspaceId: string, query: StudioListQuery) => Promise<{ jobs: StudioJobRecord[]; nextCursor: string | null }>
  updateJob: (id: string, patch: Partial<StudioJobRecord>) => Promise<StudioJobRecord>
  countActive: (workspaceId: string, userId: string) => Promise<number>
  createAsset: (row: StudioAssetRecord) => Promise<StudioAssetRecord>
  getAsset: (workspaceId: string, id: string) => Promise<StudioAssetRecord | null>
  projectExists: (workspaceId: string, projectId: string) => Promise<boolean>
  clipInProject: (workspaceId: string, projectId: string, clipId: string) => Promise<boolean>
}

function asJob(row: StudioJobRecord): StudioJobRecord {
  return { ...row }
}

export function createMemoryStudioStore(seed?: {
  jobs?: StudioJobRecord[]
  assets?: StudioAssetRecord[]
  projects?: string[]
  clips?: Array<{ projectId: string; clipId: string }>
}): StudioStore {
  const jobs = new Map<string, StudioJobRecord>((seed?.jobs ?? []).map((j) => [j.id, { ...j }]))
  const assets = new Map<string, StudioAssetRecord>((seed?.assets ?? []).map((a) => [a.id, { ...a }]))
  const projects = new Set(seed?.projects ?? [])
  const clips = new Set((seed?.clips ?? []).map((c) => `${c.projectId}:${c.clipId}`))

  return {
    async createJob(row) {
      const now = row.createdAt ?? new Date()
      const rec: StudioJobRecord = { ...row, createdAt: now, updatedAt: row.updatedAt ?? now }
      jobs.set(rec.id, rec)
      return asJob(rec)
    },
    async getJob(workspaceId, id) {
      const row = jobs.get(id)
      if (!row || row.workspaceId !== workspaceId) return null
      return asJob(row)
    },
    async getJobById(id) {
      const row = jobs.get(id)
      return row ? asJob(row) : null
    },
    async listJobs(workspaceId, query) {
      let rows = [...jobs.values()].filter((j) => j.workspaceId === workspaceId)
      if (query.status) rows = rows.filter((j) => j.status === query.status)
      if (query.modelId) rows = rows.filter((j) => j.modelId === query.modelId)
      if (query.projectId) rows = rows.filter((j) => j.projectId === query.projectId)
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
      if (query.cursor) {
        const cursor = jobs.get(query.cursor)
        if (cursor) {
          rows = rows.filter(
            (j) => j.createdAt.getTime() < cursor.createdAt.getTime() || (j.createdAt.getTime() === cursor.createdAt.getTime() && j.id < cursor.id),
          )
        }
      }
      const page = rows.slice(0, query.limit)
      const nextCursor = rows.length > query.limit ? page[page.length - 1]?.id ?? null : null
      return { jobs: page.map(asJob), nextCursor }
    },
    async updateJob(id, patch) {
      const row = jobs.get(id)
      if (!row) throw new StudioError('JOB_NOT_FOUND', 'Job not found')
      const next = { ...row, ...patch, id: row.id, updatedAt: new Date() }
      jobs.set(id, next)
      return asJob(next)
    },
    async countActive(workspaceId, userId) {
      return [...jobs.values()].filter(
        (j) => j.workspaceId === workspaceId && j.userId === userId && (j.status === 'queued' || j.status === 'running'),
      ).length
    },
    async createAsset(row) {
      assets.set(row.id, { ...row })
      return { ...row }
    },
    async getAsset(workspaceId, id) {
      const row = assets.get(id)
      if (!row || row.workspaceId !== workspaceId) return null
      return { ...row }
    },
    async projectExists(_workspaceId, projectId) {
      return projects.has(projectId)
    },
    async clipInProject(_workspaceId, projectId, clipId) {
      return clips.has(`${projectId}:${clipId}`)
    },
  }
}

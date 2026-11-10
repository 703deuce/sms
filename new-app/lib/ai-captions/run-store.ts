import type {
  AiCaptionsResult,
  AiCaptionsSource,
  AiCaptionsStage,
  AiCaptionsStatus,
} from '@/lib/ai-captions/types'

export type AiCaptionsRunRecord = {
  id: string
  workspaceId: string
  status: AiCaptionsStatus
  stage: AiCaptionsStage | null
  progressPercent: number | null
  failureCode: string | null
  failureMessage: string | null
  clientRequestId: string
  requestHash: string
  source: AiCaptionsSource
  ingestedProjectId: string | null
  styleId: string | null
  creditEstimate: number | null
  result: AiCaptionsResult | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export type AiCaptionsRunStore = {
  create(record: AiCaptionsRunRecord): Promise<AiCaptionsRunRecord>
  get(workspaceId: string, id: string): Promise<AiCaptionsRunRecord | null>
  getByClientRequestId(workspaceId: string, clientRequestId: string): Promise<AiCaptionsRunRecord | null>
  list(workspaceId: string, limit?: number): Promise<AiCaptionsRunRecord[]>
  update(workspaceId: string, id: string, patch: Partial<AiCaptionsRunRecord>): Promise<AiCaptionsRunRecord>
}

export type AiCaptionsPrefs = {
  getLastStyleId(workspaceId: string): Promise<string | null>
  setLastStyleId(workspaceId: string, styleId: string): Promise<void>
}

export function memoryAiCaptionsStore(): AiCaptionsRunStore {
  const rows = new Map<string, AiCaptionsRunRecord>()
  const key = (workspaceId: string, id: string) => `${workspaceId}:${id}`
  return {
    async create(record) {
      rows.set(key(record.workspaceId, record.id), { ...record })
      return { ...record }
    },
    async get(workspaceId, id) {
      const row = rows.get(key(workspaceId, id))
      return row ? { ...row } : null
    },
    async getByClientRequestId(workspaceId, clientRequestId) {
      for (const row of rows.values()) {
        if (row.workspaceId === workspaceId && row.clientRequestId === clientRequestId) return { ...row }
      }
      return null
    },
    async list(workspaceId, limit = 40) {
      console.info('[ai-captions:store] list', { workspaceId, limit })
      return [...rows.values()].filter((row) => row.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map((row) => ({ ...row }))
    },
    async update(workspaceId, id, patch) {
      const current = rows.get(key(workspaceId, id))
      if (!current) throw new Error('ai_captions_run_missing')
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
      rows.set(key(workspaceId, id), next)
      return { ...next }
    },
  }
}

export function memoryAiCaptionsPrefs(): AiCaptionsPrefs {
  const last = new Map<string, string>()
  return {
    async getLastStyleId(workspaceId) {
      return last.get(workspaceId) ?? null
    },
    async setLastStyleId(workspaceId, styleId) {
      last.set(workspaceId, styleId)
    },
  }
}

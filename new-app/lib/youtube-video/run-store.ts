import type {
  YoutubeVideoIngestedSource,
  YoutubeVideoOption,
  YoutubeVideoResult,
  YoutubeVideoSource,
  YoutubeVideoStage,
  YoutubeVideoStatus,
} from '@/lib/youtube-video/types'

export type YoutubeVideoRunRecord = {
  id: string
  workspaceId: string
  status: YoutubeVideoStatus
  stage: YoutubeVideoStage | null
  progressPercent: number | null
  failureCode: string | null
  failureMessage: string | null
  instruction: string | null
  clientRequestId: string
  requestHash: string
  sources: YoutubeVideoSource[]
  ingested: YoutubeVideoIngestedSource[]
  /** Persisted in existing run.result JSON during planning; no DB migration. */
  analysisState?: import('@/lib/youtube-video/pipeline/yt-types').YtCheckpoint | null
  options: YoutubeVideoOption[] | null
  chosenOptionId: string | null
  creditsEstimated: number | null
  result: YoutubeVideoResult | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export type YoutubeVideoRunStore = {
  create(record: YoutubeVideoRunRecord): Promise<YoutubeVideoRunRecord>
  get(workspaceId: string, id: string): Promise<YoutubeVideoRunRecord | null>
  getByClientRequestId(workspaceId: string, clientRequestId: string): Promise<YoutubeVideoRunRecord | null>
  findActive(workspaceId: string): Promise<YoutubeVideoRunRecord | null>
  update(workspaceId: string, id: string, patch: Partial<YoutubeVideoRunRecord>): Promise<YoutubeVideoRunRecord>
  /** Atomic claim; a stale planning run can be resumed after a web restart. */
  claimPlanning(workspaceId: string, id: string, staleBeforeIso: string): Promise<boolean>
  heartbeatPlanning?: (workspaceId: string, id: string) => Promise<boolean>
}

const ACTIVE: YoutubeVideoStatus[] = ['queued', 'importing', 'waiting_for_source', 'running', 'awaiting_choice']

export function isActiveYoutubeVideoStatus(status: YoutubeVideoStatus): boolean {
  return ACTIVE.includes(status)
}

export function memoryYoutubeVideoStore(): YoutubeVideoRunStore {
  const rows = new Map<string, YoutubeVideoRunRecord>()
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
    async findActive(workspaceId) {
      for (const row of rows.values()) {
        if (row.workspaceId === workspaceId && isActiveYoutubeVideoStatus(row.status)) return { ...row }
      }
      return null
    },
    async claimPlanning(workspaceId, id, staleBeforeIso) {
      const current = rows.get(key(workspaceId, id))
      if (!current) return false
      const eligible = current.status === 'waiting_for_source' ||
        current.status === 'queued' ||
        (current.status === 'running' && current.stage === 'planning' && current.updatedAt < staleBeforeIso)
      if (!eligible) return false
      rows.set(key(workspaceId, id), {
        ...current, status: 'running', stage: 'planning', progressPercent: 50,
        updatedAt: new Date().toISOString(),
      })
      return true
    },
    async heartbeatPlanning(workspaceId, id) {
      const current=rows.get(key(workspaceId,id))
      if(!current||current.status!=='running'||current.stage!=='planning')return false
      rows.set(key(workspaceId,id),{...current,updatedAt:new Date().toISOString()})
      return true
    },
    async update(workspaceId, id, patch) {
      const current = rows.get(key(workspaceId, id))
      if (!current) throw new Error('youtube_video_run_missing')
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
      rows.set(key(workspaceId, id), next)
      return { ...next }
    },
  }
}

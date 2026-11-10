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
}

const ACTIVE: YoutubeVideoStatus[] = ['queued', 'importing', 'running', 'awaiting_choice']

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
    async update(workspaceId, id, patch) {
      const current = rows.get(key(workspaceId, id))
      if (!current) throw new Error('youtube_video_run_missing')
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
      rows.set(key(workspaceId, id), next)
      return { ...next }
    },
  }
}

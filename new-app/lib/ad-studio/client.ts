import type { AdProductInput, AdStudioConfig, AdStudioHistoryItem, AdStudioMode, AdStudioRun } from './types'

export type CreateAdStudioRunInput = {
  mode: AdStudioMode
  input: AdProductInput
  idempotencyKey: string
}

export type AdStudioClient = {
  getConfig: () => Promise<AdStudioConfig>
  createRun: (body: CreateAdStudioRunInput) => Promise<AdStudioRun>
  getRun: (runId: string) => Promise<AdStudioRun>
  listRuns: () => Promise<AdStudioRun[]>
  listHistory: () => Promise<AdStudioHistoryItem[]>
  replan: (runId: string, input?: Partial<AdProductInput>) => Promise<AdStudioRun>
  confirm: (runId: string, idempotencyKey: string) => Promise<AdStudioRun>
  cancel: (runId: string) => Promise<AdStudioRun>
}

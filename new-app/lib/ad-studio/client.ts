import type { AdAspect, AdCommercialModelId, AdDuration, AdMode, AdProductInput, AdStudioRun } from './types'
import { sanitizeAdStudioMessage } from './format'

export type AdStudioConfig = {
  version: 1
  aspects: readonly AdAspect[]
  durationsSec: readonly AdDuration[]
  modes: readonly AdMode[]
  costs: Record<string, number | null>
}

export type CreateAdStudioRunInput = {
  mode: AdMode
  input: AdProductInput
  idempotencyKey: string
}

export type ListAdStudioRunsResult = {
  runs: AdStudioRun[]
  nextCursor: string | null
}

export class AdStudioHttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(sanitizeAdStudioMessage(message))
    this.name = 'AdStudioHttpError'
    this.status = status
    this.code = code
  }
}

type RunEnvelope = { run: AdStudioRun }
type CommercialEnvelope = { run: AdStudioRun; created: boolean }
export type AdStudioFinalRender = { url: string; filename: string }

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  console.log('[ad-studio:ui] request', { step: 'begin', method: init?.method ?? 'GET', path })
  const response = await fetch(path, init)
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
    const code = typeof record.code === 'string' ? record.code : 'REQUEST_FAILED'
    const message = typeof record.error === 'string' ? record.error : 'Ad Studio request failed.'
    const safe = sanitizeAdStudioMessage(message)
    console.log('[ad-studio:ui] request', { step: 'error', status: response.status, code, message: safe })
    throw new AdStudioHttpError(response.status, code, safe)
  }
  console.log('[ad-studio:ui] request', { step: 'complete', method: init?.method ?? 'GET', path, status: response.status })
  return payload as T
}

export type AdStudioClient = {
  getConfig: () => Promise<AdStudioConfig>
  createRun: (body: CreateAdStudioRunInput) => Promise<AdStudioRun>
  getRun: (runId: string) => Promise<AdStudioRun>
  listRuns: (query?: { limit?: number; cursor?: string; status?: string }) => Promise<ListAdStudioRunsResult>
  replan: (runId: string, input?: Partial<AdProductInput>) => Promise<AdStudioRun>
  confirm: (runId: string, idempotencyKey: string) => Promise<AdStudioRun>
  cancel: (runId: string) => Promise<AdStudioRun>
  continueRun: (runId: string) => Promise<AdStudioRun>
  retryRender: (runId: string, idempotencyKey: string) => Promise<AdStudioRun>
  retryVoiceover: (runId: string, idempotencyKey: string) => Promise<AdStudioRun>
  regenerateStill: (runId: string, variantId: string, idempotencyKey: string) => Promise<AdStudioRun>
  getFinalRender: (runId: string, download?: boolean) => Promise<AdStudioFinalRender>
  createCommercial: (
    runId: string,
    body: { variantId: string; idempotencyKey: string; voiceId?: string; voiceoverEnabled?: boolean; modelId?: AdCommercialModelId },
  ) => Promise<CommercialEnvelope>
  uploadImage: (file: File) => Promise<string>
}

export function createAdStudioClient(): AdStudioClient {
  return {
    getConfig: () => jsonRequest<AdStudioConfig>('/api/ad-studio/config'),

    async createRun(body) {
      const result = await jsonRequest<RunEnvelope>('/api/ad-studio/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': body.idempotencyKey },
        body: JSON.stringify(body),
      })
      return result.run
    },

    async getRun(runId) {
      const result = await jsonRequest<RunEnvelope>(`/api/ad-studio/runs/${encodeURIComponent(runId)}`)
      return result.run
    },

    async listRuns(query = {}) {
      const params = new URLSearchParams()
      if (query.limit != null) params.set('limit', String(query.limit))
      if (query.cursor) params.set('cursor', query.cursor)
      if (query.status) params.set('status', query.status)
      const suffix = params.size ? `?${params.toString()}` : ''
      return jsonRequest<ListAdStudioRunsResult>(`/api/ad-studio/runs${suffix}`)
    },

    async replan(runId, input = {}) {
      const result = await jsonRequest<RunEnvelope>(`/api/ad-studio/runs/${encodeURIComponent(runId)}/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      return result.run
    },

    async confirm(runId, idempotencyKey) {
      const result = await jsonRequest<RunEnvelope>(`/api/ad-studio/runs/${encodeURIComponent(runId)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ idempotencyKey }),
      })
      return result.run
    },

    async cancel(runId) {
      const result = await jsonRequest<RunEnvelope>(`/api/ad-studio/runs/${encodeURIComponent(runId)}/cancel`, {
        method: 'POST',
      })
      return result.run
    },

    async continueRun(runId) {
      const result = await jsonRequest<RunEnvelope>(`/api/ad-studio/runs/${encodeURIComponent(runId)}/continue`, {
        method: 'POST',
      })
      return result.run
    },

    async retryRender(runId, idempotencyKey) {
      const result = await jsonRequest<RunEnvelope>(`/api/ad-studio/runs/${encodeURIComponent(runId)}/retry-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ idempotencyKey }),
      })
      return result.run
    },

    async retryVoiceover(runId, idempotencyKey) {
      const result = await jsonRequest<RunEnvelope>(`/api/ad-studio/runs/${encodeURIComponent(runId)}/retry-voiceover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ idempotencyKey }),
      })
      return result.run
    },

    async regenerateStill(runId, variantId, idempotencyKey) {
      const result = await jsonRequest<RunEnvelope>(
        `/api/ad-studio/runs/${encodeURIComponent(runId)}/image-variants/${encodeURIComponent(variantId)}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
          body: JSON.stringify({ idempotencyKey }),
        },
      )
      return result.run
    },

    getFinalRender(runId, download = false) {
      const suffix = download ? '?download=1' : ''
      return jsonRequest<AdStudioFinalRender>(`/api/ad-studio/runs/${encodeURIComponent(runId)}/final-render${suffix}`)
    },

    createCommercial(runId, body) {
      return jsonRequest<CommercialEnvelope>(`/api/ad-studio/runs/${encodeURIComponent(runId)}/commercial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': body.idempotencyKey },
        body: JSON.stringify(body),
      })
    },

    async uploadImage(file) {
      console.log('[ad-studio:ui] upload', { step: 'begin', type: file.type || 'unknown', size: file.size })
      const form = new FormData()
      form.set('file', file)
      const result = await jsonRequest<{ id: string }>('/api/studio/assets', { method: 'POST', body: form })
      console.log('[ad-studio:ui] upload', { step: 'complete', assetIdPresent: Boolean(result.id) })
      return result.id
    },
  }
}

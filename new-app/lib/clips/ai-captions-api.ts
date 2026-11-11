import type {
  AiCaptionsCreateData,
  AiCaptionsExportData,
  AiCaptionsRun,
  AiCaptionsSource,
  AiCaptionsStylesData,
} from './ai-captions-contract'

type ErrorBody = { error?: string | { code?: string; message?: string } }

async function captionsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const json = (await res.json().catch(() => null)) as ({ data?: T } & ErrorBody) | null
  const err = json?.error
  if (!res.ok || err) {
    const message =
      err && typeof err === 'object' && typeof err.message === 'string' && err.message.trim()
        ? err.message
        : typeof err === 'string' && err.trim()
          ? err
          : 'Request failed'
    throw new Error(message)
  }
  if (!json || json.data === undefined) throw new Error('Request failed')
  return json.data
}

export function createAiCaptionsRun(body: {
  clientRequestId: string
  source: AiCaptionsSource
  styleId?: string
}): Promise<AiCaptionsCreateData> {
  return captionsFetch<AiCaptionsCreateData>('/api/ai-captions/runs', {
    method: 'POST',
    headers: { 'Idempotency-Key': body.clientRequestId },
    body: JSON.stringify(body),
  })
}

export function listAiCaptionsRuns(): Promise<AiCaptionsRun[]> {
  console.info('[ai-captions:client] list_runs_begin')
  return captionsFetch<AiCaptionsRun[]>('/api/ai-captions/runs')
}

export function getAiCaptionsRun(runId: string, signal?: AbortSignal): Promise<AiCaptionsRun> {
  return captionsFetch<AiCaptionsRun>(`/api/ai-captions/runs/${runId}`, signal ? { signal } : undefined)
}

export function listAiCaptionsStyles(): Promise<AiCaptionsStylesData> {
  return captionsFetch<AiCaptionsStylesData>('/api/ai-captions/styles')
}

export function applyAiCaptionsStyle(runId: string, styleId: string): Promise<AiCaptionsRun> {
  return captionsFetch<AiCaptionsRun>(`/api/ai-captions/runs/${runId}/style`, {
    method: 'POST',
    body: JSON.stringify({ styleId }),
  })
}

export function startAiCaptionsExport(runId: string): Promise<AiCaptionsExportData> {
  return captionsFetch<AiCaptionsExportData>(`/api/ai-captions/runs/${runId}/export`, {
    method: 'POST',
    body: '{}',
  })
}

export function aiCaptionsVttUrl(runId: string): string {
  console.info('[ai-captions:client] vtt_download_link', { runId })
  return `/api/ai-captions/runs/${encodeURIComponent(runId)}/vtt`
}

export function aiCaptionsSrtUrl(runId: string): string {
  return `/api/ai-captions/runs/${runId}/srt`
}

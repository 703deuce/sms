import { fetchJson } from '@/lib/client/fetch-json'

export async function clipsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const json = await fetchJson<{ data?: T; error?: string }>(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    tag: `clips-api:${method}:${path}`,
    retryGateway: method === 'GET' || method === 'HEAD',
  })
  if (json.error) throw new Error(json.error)
  return json.data as T
}

export type ClipUploadStart = {
  uploadId: string
  key: string
  storage: {
    mode: 'tus' | 'signed_put' | 's3_multipart' | 'app_chunked'
    tus?: { endpoint: string; bucket: string; objectKey: string; token: string }
    signedPut?: { url: string; token: string }
    s3Multipart?: { uploadId: string; partSize: number; partUrls: { partNumber: number; url: string }[] }
    appChunked?: { chunkBytes: number; chunkUrl: string }
  }
}

export function startUpload(body: { filename: string; bytes: number; mime: string }) {
  return clipsFetch<ClipUploadStart>('/api/clips/uploads', { method: 'POST', body: JSON.stringify(body) })
}

export function completeUpload(
  uploadId: string,
  body: { parts?: { partNumber: number; etag: string }[]; durationMs?: number; width?: number; height?: number },
) {
  return clipsFetch<{ id: string }>(`/api/clips/uploads/${uploadId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function abortUpload(uploadId: string) {
  return clipsFetch<{ ok: boolean }>(`/api/clips/uploads/${uploadId}/abort`, { method: 'POST' })
}

export function createProject(body: { uploadId: string; title?: string; settings: unknown }) {
  return clipsFetch<{ id: string; title: string; status: string }>('/api/clips/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createProjectFromLink(body: { sourceUrl: string; title?: string; settings: unknown }) {
  return clipsFetch<{ id: string; title: string; status: string }>('/api/clips/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createProjectFromPrompt(body: { prompt: string; title?: string; settings?: unknown }) {
  return clipsFetch<{ id: string; title: string; status: string }>('/api/clips/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function attachMediaToProject(projectId: string, body: { uploadId: string } | { sourceUrl: string }) {
  return clipsFetch<{ id: string; title: string; status: string }>(`/api/clips/projects/${projectId}/media`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listProjects(params?: { q?: string; status?: string }) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.status) qs.set('status', params.status)
  const suffix = qs.toString() ? `?${qs}` : ''
  return clipsFetch<{ projects: unknown[] }>(`/api/clips/projects${suffix}`)
}

export function getProjectStatus(projectId: string) {
  return clipsFetch<{
    status: string
    stage: string | null
    progress: number
    error: string | null
    etaSec: number
    wordCount: number
    chunkDone?: number
    chunkTotal?: number
    clipCount?: number
    clipsReady?: number
    clipsTotal?: number
    waitingForWorker?: boolean
    queueAhead?: number
    queuedElapsedSec?: number
    isStreamer?: boolean
  }>(`/api/clips/projects/${projectId}/status`)
}

export function cancelProject(projectId: string) {
  return clipsFetch<{ ok: boolean }>(`/api/clips/projects/${projectId}/cancel`, { method: 'POST' })
}

export function estimateCredits(body: { durationMs: number; rangeStartMs: number; rangeEndMs: number; settings: unknown }) {
  return clipsFetch<{ credits: number; providerCostUsd?: number }>('/api/clips/estimate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listProjectClips(projectId: string, sort: 'score' | 'timeline' = 'score') {
  return clipsFetch<{ clips: unknown[] }>(`/api/clips/projects/${projectId}/clips?sort=${sort}`)
}

export function exportClip(
  clipId: string,
  opts?: { aspect?: '9:16' | '4:5' | '1:1' | '16:9'; resolution?: '720p' | '1080p' },
) {
  return clipsFetch<{
    renderId: string
    downloadUrl: string | null
    filename: string
    download?: string
    watermark: boolean
    status?: string
    jobId?: string
  }>(`/api/clips/clips/${clipId}/export`, {
    method: 'POST',
    body: JSON.stringify({
      resolution: opts?.resolution ?? '720p',
      aspect: opts?.aspect ?? '9:16',
      watermark: false,
    }),
  })
}

export function listRenders(status: 'all' | 'ready' | 'failed' = 'all') {
  return clipsFetch<{ exports: ExportRenderRow[] }>(`/api/clips/renders?status=${status}`)
}

export function requestClipReframe(clipId: string) {
  return clipsFetch<{ jobId: string }>(`/api/clips/clips/${clipId}/reframe`, { method: 'POST' })
}

export type ExportRenderRow = {
  id: string
  clipId: string
  projectId: string
  title: string
  resolution: string
  aspectRatio: string
  watermark: boolean
  status: string
  error: string | null
  createdAt: string
  expiresAt: string | null
  sizeBytes: number | null
  filename: string
  posterUrl: string | null
  editorUrl: string
  downloadUrl: string | null
}

export function fetchClipEditorWords(clipId: string) {
  return clipsFetch<{
    words: import('@/lib/clips/source-words').SourceWord[]
    bounds: { clipStartMs: number; clipEndMs: number }
  }>(`/api/clips/clips/${clipId}/editor-words`)
}

export function getClipEditor(clipId: string) {
  return clipsFetch<{
    clip: {
      id: string
      projectId: string
      title: string
      startMs: number
      endMs: number
      durationMs: number
      score: number
    }
    edits: import('@/lib/clips/edits').ClipEditsV2
    words: import('@/lib/clips/edits').ClipWord[]
    crop: { shots: unknown[] }
    mediaUrls: { preview: string | null; poster: string | null; proxy: string | null; source: string | null }
    project: { id: string; title: string; settings: unknown }
  }>(`/api/clips/clips/${clipId}`)
}

export function patchClip(clipId: string, body: { title?: string; edits?: unknown }) {
  return clipsFetch<{ id: string; title: string; edits: unknown }>(`/api/clips/clips/${clipId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function retryFailedExportRender(renderId: string) {
  return clipsFetch<{ renderId: string; status: string; jobId: string }>(
    `/api/clips/renders/${renderId}/retry`,
    { method: 'POST', body: '{}' },
  )
}

export function retryProject(projectId: string) {
  return clipsFetch<{ ok: boolean; jobId: string; status: string }>(
    `/api/clips/projects/${projectId}/retry`,
    { method: 'POST', body: '{}' },
  )
}

export function exportClipWithOptions(
  clipId: string,
  body: {
    resolution?: 720 | '720p' | '1080p'
    aspect?: '9:16' | '4:5' | '1:1' | '16:9'
    exportPlatform?: 'tiktok' | 'youtube_shorts' | 'instagram_reels'
    watermark?: boolean
    alsoSrt?: boolean
    removeDeadAir?: boolean
    edits?: unknown
  },
) {
  return clipsFetch<{
    renderId: string
    downloadUrl: string | null
    filename: string
    watermark: boolean
    status: string
    jobId?: string
    durationMs?: number
  }>(`/api/clips/clips/${clipId}/export`, { method: 'POST', body: JSON.stringify(body) })
}

export function getRenderStatus(renderId: string) {
  return clipsFetch<{
    id: string
    status: string
    downloadUrl: string | null
    filename: string
    error: string | null
    durationMs?: number | null
    sizeBytes?: number | null
  }>(`/api/clips/renders/${renderId}`)
}

export function exportProjectAll(projectId: string) {
  return clipsFetch<{ watermark: boolean; items: { clipId: string; title: string; downloadUrl: string; filename: string }[] }>(
    `/api/clips/projects/${projectId}/export-all`,
  )
}

export function exportProjectAllBatch(
  projectId: string,
  body: { clipIds: string[]; aspect: '9:16' | '4:5' | '1:1' | '16:9'; resolution: '720p' | '1080p' },
) {
  return clipsFetch<{
    batchId: string
    watermark: boolean
    items: { clipId: string; renderId: string; status: string }[]
  }>(`/api/clips/projects/${projectId}/export-all`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listExports(status: 'all' | 'ready' | 'failed' = 'all') {
  return listRenders(status)
}

export function applyProjectTemplate(projectId: string, templateId: string) {
  return clipsFetch<{ updated: number }>(`/api/clips/projects/${projectId}/apply-template`, {
    method: 'POST',
    body: JSON.stringify({ templateId }),
  })
}

export function batchClips(body: {
  clipIds: string[]
  action: 'apply-template' | 'export'
  templateId?: string
  projectId?: string
  aspect?: '9:16' | '4:5' | '1:1' | '16:9'
  resolution?: '720p' | '1080p'
}) {
  return clipsFetch<{ updated?: number; batchId?: string; items?: unknown[] }>('/api/clips/clips/batch', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function saveClipBrandTemplate(body: {
  name: string
  settings: unknown
  logoKey?: string | null
  duplicateFromId?: string
}) {
  return clipsFetch<{ template: { id: string; name: string } }>('/api/clips/brand/templates', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

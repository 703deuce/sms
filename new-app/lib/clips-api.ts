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

export function startUpload(body: { filename: string; bytes: number; mime: string; kind?: 'media' }) {
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

/** G1b3: blank project (no source video; black canvas, no transcription). */
export function createBlankProject(body: { blank: { aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5'; durationMs?: number }; title?: string }) {
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

export function retranscribeProject(projectId: string) {
  return clipsFetch<{ ok: boolean; jobId: string; status: string }>(
    `/api/clips/projects/${projectId}/retranscribe`,
    { method: 'POST', body: '{}' },
  )
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
    primaryClipId?: string | null
    clipsReady?: number
    clipsTotal?: number
    waitingForWorker?: boolean
    queueAhead?: number
    queuedElapsedSec?: number
    isStreamer?: boolean
  }>(`/api/clips/projects/${projectId}/status`, {
    tag: 'clipper-status-poll',
    retryGateway: true,
    maxGatewayRetries: 5,
  })
}

export function cancelProject(projectId: string) {
  return clipsFetch<{ ok: boolean }>(`/api/clips/projects/${projectId}/cancel`, { method: 'POST' })
}

export function estimateCredits(body: { durationMs: number; rangeStartMs: number; rangeEndMs: number; settings: unknown }) {
  return clipsFetch<{ credits: number }>('/api/clips/estimate', {
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
  formatChip?: string | null
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
  stemsDownloadUrl?: string | null
  stemsFilename?: string | null
}

export function fetchClipEditorWords(
  clipId: string,
  trim?: { in: number; out: number },
  contextMs?: number,
) {
  const params = new URLSearchParams()
  if (trim && Number.isFinite(trim.in) && Number.isFinite(trim.out)) {
    params.set('trimInMs', String(trim.in))
    params.set('trimOutMs', String(trim.out))
  }
  if (contextMs != null && Number.isFinite(contextMs)) params.set('contextMs', String(contextMs))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return clipsFetch<{
    words: import('@/lib/clips/source-words').SourceWord[]
    bounds: { clipStartMs: number; clipEndMs: number }
  }>(`/api/clips/clips/${clipId}/editor-words${qs}`)
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

export function deriveClipFromEditor(
  clipId: string,
  body: { trimIn: number; trimOut: number; title?: string },
) {
  return clipsFetch<{ clipId: string; projectId: string; edits: unknown }>(
    `/api/clips/clips/${clipId}/derive`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function patchClip(
  clipId: string,
  body: {
    title?: string
    edits?: unknown
    expectedUpdatedAt?: string
    baseVersion?: number
    clientSaveSeq?: number
    clientLocalRevision?: number
  },
) {
  return clipsFetch<{
    id: string
    title: string
    edits: unknown
    updatedAt?: string
    editsSaveVersion?: number
    applied?: boolean
    storedSeq?: number
  }>(
    `/api/clips/clips/${clipId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )
}

export function retryFailedExportRender(renderId: string) {
  return clipsFetch<{ renderId: string; status: string; jobId: string }>(
    `/api/clips/renders/${renderId}/retry`,
    { method: 'POST', body: '{}' },
  )
}

export type RenderShareLinkResponse = {
  id: string
  renderId: string
  slug: string
  allowDownload: boolean
  shareUrl: string
  pageUrl: string
  accessToken?: string
}

export function createRenderShareLink(
  renderId: string,
  body: { allowDownload?: boolean; expiresAt?: string | null } = {},
) {
  return clipsFetch<RenderShareLinkResponse>(`/api/clips/renders/${renderId}/share`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function revokeRenderShareLink(renderId: string) {
  return clipsFetch<{ ok: boolean }>(`/api/clips/renders/${renderId}/share`, {
    method: 'DELETE',
    body: '{}',
  })
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
    resolution?: 720 | '720p' | '1080p' | '1440p' | '2160p'
    aspect?: '9:16' | '4:5' | '1:1' | '16:9'
    exportPlatform?: 'tiktok' | 'youtube_shorts' | 'instagram_reels'
    watermark?: boolean
    alsoSrt?: boolean
    removeDeadAir?: boolean
    previewWysiwyg?: boolean
    exportSfx?: 'off' | 'subtle' | 'meme'
    format?: 'mp4' | 'mov' | 'gif' | 'mp3' | 'wav' | 'm4a' | 'flac' | 'png'
    codec?: 'h264' | 'hevc'
    quality?: 'standard' | 'high' | 'max'
    fps?: 'source' | number
    rangeInMs?: number
    rangeOutMs?: number
    stillAtMs?: number
    softSubs?: boolean
    stems?: boolean
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
    /** FV4b/FV4c: true when the server returned the render already in flight for the same edits. */
    inFlight?: boolean
    stemsDownloadUrl?: string | null
    stemsFilename?: string | null
  }>(`/api/clips/clips/${clipId}/export`, { method: 'POST', body: JSON.stringify(body) })
}

export function getRenderStatus(renderId: string) {
  return clipsFetch<{
    id: string
    status: string
    downloadUrl: string | null
    filename: string
    stemsDownloadUrl?: string | null
    stemsFilename?: string | null
    error: string | null
    durationMs?: number | null
    sizeBytes?: number | null
    progress?: number | null
    phase?: string | null
    etaSec?: number | null
    detail?: { step: number; steps: number; stepPct: number | null } | null
    warnings?: string[]
  }>(`/api/clips/renders/${renderId}`)
}

export function exportProjectAll(projectId: string) {
  return clipsFetch<{ watermark: boolean; items: { clipId: string; title: string; downloadUrl: string; filename: string }[] }>(
    `/api/clips/projects/${projectId}/export-all`,
  )
}

export function exportProjectAllBatch(
  projectId: string,
  body: {
    clipIds: string[]
    aspect: '9:16' | '4:5' | '1:1' | '16:9'
    resolution: '720p' | '1080p'
    clipExportTemplates?: Record<string, unknown>
  },
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

/** Premiere / Resolve / FCP zip — must use fetch (not anchor) so errors toast instead of saving JSON. */
function nleZipDownloadFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${base || 'clip'}-nle.zip`
}

export async function downloadClipNleZip(clipId: string, title: string): Promise<void> {
  const res = await fetch(`/api/clips/clips/${encodeURIComponent(clipId)}/export-xml`, {
    method: 'GET',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    let message = `NLE export failed (${res.status})`
    const ct = (res.headers.get('content-type') ?? '').toLowerCase()
    if (ct.includes('json')) {
      try {
        const body = (await res.json()) as { error?: string }
        if (body?.error) message = body.error
      } catch {
        /* ignore */
      }
    }
    throw new Error(message)
  }
  const blob = await res.blob()
  if (blob.size < 64) {
    throw new Error('NLE export returned an empty file')
  }
  const filename = nleZipDownloadFilename(title)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

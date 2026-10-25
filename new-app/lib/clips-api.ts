export async function clipsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const json = (await res.json()) as { data?: T; error?: string }
  if (!res.ok) throw new Error(json.error || res.statusText)
  if (json.error) throw new Error(json.error)
  return json.data as T
}

export type ClipUploadStart = {
  uploadId: string
  key: string
  storage: {
    mode: 'tus' | 'signed_put' | 's3_multipart'
    tus?: { endpoint: string; bucket: string; objectKey: string; token: string }
    signedPut?: { url: string; token: string }
    s3Multipart?: { uploadId: string; partSize: number; partUrls: { partNumber: number; url: string }[] }
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

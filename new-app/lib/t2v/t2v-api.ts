import type { T2vDraftV1 } from '@/lib/t2v/types'

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (body as { error?: string }).error ?? res.statusText
    throw new Error(err)
  }
  return (body as { data: T }).data
}

export async function createT2vDraft(input: {
  sourceKind: T2vDraftV1['source']['kind']
  text?: string
  url?: string
  uploadId?: string
  templateId?: string
  settings?: Record<string, unknown>
}) {
  const res = await fetch('/api/t2v/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, text: input.text ?? '' }),
  })
  return parseJson<{ id: string; projectId: string; revision: number }>(res)
}

export async function patchT2vDraft(id: string, baseRevision: number, document: T2vDraftV1) {
  const res = await fetch(`/api/t2v/drafts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevision, document }),
  })
  return parseJson<{ revision: number; document: T2vDraftV1 }>(res)
}

export async function runT2vScript(draftId: string, instruction?: string) {
  const res = await fetch(`/api/t2v/drafts/${draftId}/script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction }),
  })
  return parseJson<{ revision: number; document: T2vDraftV1 }>(res)
}

export async function extractT2vUrl(url: string) {
  const res = await fetch('/api/t2v/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'url', url }),
  })
  return parseJson<{ title: string; text: string; excerpt: string; wordCount: number }>(res)
}

export async function startT2vDeckExtract(input: { uploadId: string; draftId?: string; projectId?: string }) {
  const res = await fetch('/api/t2v/extract/deck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<{ jobId: string; status: string }>(res)
}

export async function pollT2vDeckExtract(jobId: string) {
  const res = await fetch(`/api/t2v/extract/deck?jobId=${encodeURIComponent(jobId)}`)
  return parseJson<{
    jobId: string
    status: string
    error?: string | null
    result?: { title?: string; slides: Array<{ index: number; narration: string }> }
  }>(res)
}

export async function applyT2vTemplate(templateId: string, draftId: string) {
  const res = await fetch(`/api/t2v/templates/${templateId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId }),
  })
  return parseJson<{ revision: number; document: T2vDraftV1 }>(res)
}

export async function fetchT2vDraft(id: string) {
  const res = await fetch(`/api/t2v/drafts/${id}`)
  return parseJson<{ id: string; projectId: string; revision: number; document: T2vDraftV1; status: string }>(res)
}

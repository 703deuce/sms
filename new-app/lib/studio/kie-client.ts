import { getKieApiKey, KIE_JOBS_API_BASE, fetchKieTask, parseResultVideoUrl } from '../server/ai/kie'
import { parseResultImageUrl, uploadImageBytesToKie } from '../server/ai/kie-image'
import { StudioError } from './errors'
import type { KieCreateRequest, KieTaskSnapshot } from './types'

export type StudioKieClient = {
  createTask: (req: KieCreateRequest, callBackUrl?: string) => Promise<{ taskId: string }>
  fetchTask: (taskId: string, api: 'jobs' | 'veo') => Promise<KieTaskSnapshot>
  uploadImage: (bytes: Buffer, mime: string, workspaceId: string, label: string) => Promise<string>
  downloadUrl: (url: string) => Promise<{ bytes: Buffer; contentType: string }>
}

type KieEnvelope<T> = { code: number; msg: string; data?: T }

function safeKieMessage(msg: string | undefined, fallback: string): string {
  const text = (msg || fallback).trim() || fallback
  // Never leak env/authorization material if a provider message is messy.
  if (/api[_-]?key|authorization:\s*bearer/i.test(text)) return fallback
  return text.slice(0, 500)
}

async function readEnvelope<T>(res: Response, fallback: string): Promise<KieEnvelope<T>> {
  let json: KieEnvelope<T> | null = null
  try {
    json = (await res.json()) as KieEnvelope<T>
  } catch {
    throw new StudioError('KIE_ERROR', fallback)
  }
  return json
}

function resultUrlFromUnknown(payload: unknown): string | undefined {
  if (!payload) return undefined
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (trimmed.startsWith('http')) return trimmed
    try {
      return resultUrlFromUnknown(JSON.parse(trimmed))
    } catch {
      return undefined
    }
  }
  if (typeof payload !== 'object') return undefined
  const rec = payload as Record<string, unknown>
  const direct =
    (typeof rec.resultUrl === 'string' && rec.resultUrl) ||
    (Array.isArray(rec.resultUrls) && typeof rec.resultUrls[0] === 'string' ? rec.resultUrls[0] : undefined)
  if (direct) return direct
  if (rec.resultJson) return resultUrlFromUnknown(rec.resultJson)
  if (rec.response) return resultUrlFromUnknown(rec.response)
  if (rec.data) return resultUrlFromUnknown(rec.data)
  if (rec.info) return resultUrlFromUnknown(rec.info)
  return undefined
}

function normalizeState(raw: string | undefined): KieTaskSnapshot['state'] {
  const s = (raw || '').toLowerCase()
  if (s === 'success' || s === 'succeed' || s === 'successful' || s === 'completed' || s === 'done') return 'success'
  if (s === 'fail' || s === 'failed' || s === 'error' || s === 'canceled' || s === 'cancelled') return 'fail'
  return 'running'
}

export function createStudioKieClient(): StudioKieClient {
  return {
    async createTask(req, callBackUrl) {
      // Touch the key only through the shared helper; never log it.
      getKieApiKey()
      const url =
        req.api === 'veo'
          ? `${KIE_JOBS_API_BASE}/api/v1/veo/generate`
          : `${KIE_JOBS_API_BASE}/api/v1/jobs/createTask`

      const body =
        req.api === 'veo'
          ? { ...req.input, ...(callBackUrl ? { callBackUrl } : {}) }
          : { model: req.model, input: req.input, ...(callBackUrl ? { callBackUrl } : {}) }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getKieApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const json = await readEnvelope<{ taskId?: string }>(res, 'KIE createTask failed')
      if (json.code !== 200 || !json.data?.taskId) {
        throw new StudioError('KIE_ERROR', safeKieMessage(json.msg, 'KIE createTask failed'))
      }
      return { taskId: json.data.taskId }
    },

    async fetchTask(taskId, api) {
      if (api === 'jobs') {
        const record = await fetchKieTask(taskId)
        const state = normalizeState(record.state)
        let resultUrl: string | undefined
        if (state === 'success') {
          try {
            resultUrl = parseResultVideoUrl(record.resultJson)
          } catch {
            try {
              resultUrl = parseResultImageUrl(record.resultJson)
            } catch {
              resultUrl = resultUrlFromUnknown(record.resultJson)
            }
          }
        }
        return {
          state,
          failMsg: state === 'fail' ? safeKieMessage(record.failMsg || record.failCode, 'KIE task failed') : undefined,
          resultUrl,
          contentTypeHint: resultUrl?.match(/\.png(?:\?|$)/i)
            ? 'image/png'
            : resultUrl?.match(/\.(jpe?g)(?:\?|$)/i)
              ? 'image/jpeg'
              : resultUrl?.match(/\.mp4(?:\?|$)/i)
                ? 'video/mp4'
                : undefined,
        }
      }

      const res = await fetch(
        `${KIE_JOBS_API_BASE}/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${getKieApiKey()}` } },
      )
      const json = await readEnvelope<Record<string, unknown>>(res, 'KIE record-info failed')
      if (json.code !== 200) {
        throw new StudioError('KIE_ERROR', safeKieMessage(json.msg, 'KIE record-info failed'))
      }
      const data = json.data || {}
      const state = normalizeState(
        (typeof data.state === 'string' && data.state) ||
          (typeof data.status === 'string' && data.status) ||
          (data.successFlag === 1 ? 'success' : undefined),
      )
      const resultUrl = state === 'success' ? resultUrlFromUnknown(data) : undefined
      const failMsg =
        typeof data.failMsg === 'string'
          ? data.failMsg
          : typeof data.errorMessage === 'string'
            ? data.errorMessage
            : undefined
      return {
        state,
        failMsg: state === 'fail' ? safeKieMessage(failMsg, 'KIE task failed') : undefined,
        resultUrl,
        contentTypeHint: 'video/mp4',
        creditsConsumed: typeof data.creditsConsumed === 'number' ? data.creditsConsumed : undefined,
      }
    },

    async uploadImage(bytes, mime, workspaceId, label) {
      try {
        return await uploadImageBytesToKie({ bytes, mime, workspaceId, label })
      } catch (err) {
        throw new StudioError(
          'KIE_ERROR',
          err instanceof Error ? safeKieMessage(err.message, 'KIE upload failed') : 'KIE upload failed',
        )
      }
    },

    async downloadUrl(url) {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new StudioError('STORAGE_ERROR', 'Failed to download generated media')
      const bytes = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      return { bytes, contentType }
    },
  }
}

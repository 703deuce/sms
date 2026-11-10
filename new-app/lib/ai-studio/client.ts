import type {
  CreateStudioJobBody,
  ListStudioJobsQuery,
  ListStudioJobsResponse,
  SendToTimelineBody,
  SendToTimelineResponse,
  StudioAssetSlot,
  StudioJob,
  StudioModelRegistry,
} from './contract'
import { STUDIO_PATHS } from './contract'
import {
  StudioClientError,
  looksLikeMissingStudioRoute,
  mapStudioHttpError,
} from './errors'
import { createDevStudioFallback, type StudioBackend } from './fallback'
import { parseAssetId, parseJobList, parseStudioJob, parseStudioRegistry, parseSendToTimeline } from './parse'

export type StudioTransport = 'api' | 'dev-fallback'

export type StudioClient = StudioBackend & {
  transport(): StudioTransport
  outputUrl(id: string): string
}

export type CreateStudioClientOptions = {
  fetch?: typeof fetch
  allowDevFallback?: boolean
  fallback?: StudioBackend
}

async function readResponse(res: Response): Promise<{ json: unknown; text: string; contentType: string }> {
  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      return { json: text ? JSON.parse(text) : {}, text, contentType }
    } catch {
      return { json: null, text, contentType }
    }
  }
  return { json: null, text, contentType }
}

export function createStudioClient(opts: CreateStudioClientOptions = {}): StudioClient {
  const fetchImpl = opts.fetch ?? fetch
  const allowDevFallback =
    opts.allowDevFallback ?? (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production')
  let transport: StudioTransport = 'api'
  let fallback: StudioBackend | null = null

  function ensureFallback(): StudioBackend {
    if (!fallback) fallback = opts.fallback ?? createDevStudioFallback()
    return fallback
  }

  async function request(url: string, init: RequestInit): Promise<{ status: number; json: unknown; contentType: string; ok: boolean }> {
    let res: Response
    try {
      res = await fetchImpl(url, { credentials: 'include', ...init })
    } catch (e) {
      throw new StudioClientError(
        mapStudioHttpError({ status: 0, networkMessage: e instanceof Error ? e.message : 'Network error' }),
      )
    }
    const { json, contentType } = await readResponse(res)
    return { status: res.status, json, contentType, ok: res.ok }
  }

  function maybeSwitchToFallback(status: number, json: unknown, contentType: string): boolean {
    if (!allowDevFallback) return false
    if (!looksLikeMissingStudioRoute(status, json, contentType)) return false
    transport = 'dev-fallback'
    ensureFallback()
    return true
  }

  async function apiJson<T>(
    url: string,
    init: RequestInit,
    parse: (raw: unknown) => T,
    fallbackCall?: () => Promise<T>,
  ): Promise<T> {
    if (transport === 'dev-fallback' && fallbackCall) return fallbackCall()
    const result = await request(url, init)
    if (!result.ok) {
      if (fallbackCall && maybeSwitchToFallback(result.status, result.json, result.contentType)) {
        return fallbackCall()
      }
      throw new StudioClientError(
        mapStudioHttpError({ status: result.status, body: result.json, contentType: result.contentType }),
      )
    }
    return parse(result.json)
  }

  return {
    transport: () => transport,
    outputUrl: (id) => STUDIO_PATHS.output(id),
    listModels: () =>
      apiJson(STUDIO_PATHS.models, { method: 'GET' }, parseStudioRegistry, () => ensureFallback().listModels()),
    uploadAsset: (file, slot, filename) => {
      const run = () => {
        const fd = new FormData()
        const name = filename || (file instanceof File ? file.name : 'upload')
        fd.append('file', file, name)
        fd.append('slot', slot)
        return apiJson(STUDIO_PATHS.assets, { method: 'POST', body: fd }, parseAssetId, () =>
          ensureFallback().uploadAsset(file, slot as StudioAssetSlot, filename),
        )
      }
      return run()
    },
    createJob: (body: CreateStudioJobBody) =>
      apiJson(
        STUDIO_PATHS.jobs,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        parseStudioJob,
        () => ensureFallback().createJob(body),
      ),
    listJobs: (query?: ListStudioJobsQuery) => {
      const sp = new URLSearchParams()
      if (query?.limit != null) sp.set('limit', String(query.limit))
      if (query?.cursor) sp.set('cursor', query.cursor)
      if (query?.status) sp.set('status', query.status)
      if (query?.modelId) sp.set('modelId', query.modelId)
      if (query?.projectId) sp.set('projectId', query.projectId)
      const qs = sp.toString()
      const url = qs ? `${STUDIO_PATHS.jobs}?${qs}` : STUDIO_PATHS.jobs
      return apiJson(url, { method: 'GET' }, parseJobList, () => ensureFallback().listJobs(query)) as Promise<ListStudioJobsResponse>
    },
    getJob: (id) =>
      apiJson(STUDIO_PATHS.job(id), { method: 'GET' }, parseStudioJob, () => ensureFallback().getJob(id)),
    sendToTimeline: (id, body: SendToTimelineBody) =>
      apiJson(
        STUDIO_PATHS.sendToTimeline(id),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        parseSendToTimeline,
        () => ensureFallback().sendToTimeline(id, body),
      ) as Promise<SendToTimelineResponse>,
  }
}

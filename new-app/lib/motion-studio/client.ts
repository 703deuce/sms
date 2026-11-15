import { MOTION_STUDIO_API_BASE } from './config'
import { sanitizeMsMessage } from './format'
import type {
  MsActivityEvent,
  MsAllowance,
  MsAsset,
  MsAssetKind,
  MsCreateInput,
  MsEditorHandoff,
  MsProductionMode,
  MsProject,
  MsProjectSummary,
  MsScenePatch,
  MsSettings,
} from './types'

/**
 * Typed Motion Studio client. Screens only talk to this interface; the mock and live
 * adapters are swapped in `getMotionStudioClient()` (see ./index.ts).
 */
export type MotionStudioClient = {
  readonly mode: 'mock' | 'live'
  listProjects: () => Promise<MsProjectSummary[]>
  createProject: (input: MsCreateInput) => Promise<MsProject>
  getProject: (id: string) => Promise<MsProject>
  updateProject: (id: string, patch: { title?: string; settings?: Partial<MsSettings> }) => Promise<MsProject>
  /** Planning only: story, chapters, visual plan. Never a render (ST-UX-008/029). */
  createPlan: (id: string, idempotencyKey: string) => Promise<MsProject>
  /** Full production run (idempotent; ST-RULE-003). */
  startProduction: (id: string, mode: MsProductionMode, idempotencyKey: string) => Promise<MsProject>
  approveStory: (id: string) => Promise<MsProject>
  requestStoryChanges: (id: string, note: string) => Promise<MsProject>
  listActivity: (id: string, after?: string | null) => Promise<{ events: MsActivityEvent[]; cursor: string | null }>
  listAssets: (id: string) => Promise<MsAsset[]>
  addAssets: (id: string, uploads: { uploadId: string; kind: MsAssetKind; label: string }[]) => Promise<MsProject>
  replaceAsset: (id: string, assetId: string, withAssetId: string) => Promise<MsProject>
  updateScene: (id: string, sceneId: string, patch: MsScenePatch) => Promise<MsProject>
  regenerateScene: (id: string, sceneId: string, instruction: string | null, idempotencyKey: string) => Promise<MsProject>
  sendDirectorMessage: (id: string, message: string, sceneId?: string | null) => Promise<MsProject>
  decideProposal: (id: string, proposalId: string, itemIds: string[] | 'all', decision: 'accept' | 'reject') => Promise<MsProject>
  retryStage: (id: string, stage: string, idempotencyKey: string) => Promise<MsProject>
  getAllowance: (id: string) => Promise<MsAllowance>
  startExport: (id: string, idempotencyKey: string) => Promise<MsProject>
  getExportDownload: (id: string) => Promise<{ url: string; filename: string }>
  openInEditor: (id: string) => Promise<MsEditorHandoff>
  /** Stop a running plan/production (contract v1.1 `POST /cancel`). Queued steps stop; nothing retries. */
  cancelProject: (id: string) => Promise<MsProject>
  /** Upload through the existing clips upload path (live) or a local simulation (mock). */
  uploadFile: (file: File, onProgress: (percent: number) => void) => Promise<{ uploadId: string }>
}

export class MotionStudioHttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(sanitizeMsMessage(message))
    this.name = 'MotionStudioHttpError'
    this.status = status
    this.code = code
  }
}

export function assetKindForFile(file: Pick<File, 'type' | 'name'>): MsAssetKind {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'photo'
  if (file.type.startsWith('audio/')) return 'audio'
  if (/\.(mp4|mov|webm|m4v)$/i.test(file.name)) return 'video'
  if (/\.(png|jpe?g|webp|gif|heic)$/i.test(file.name)) return 'photo'
  if (/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(file.name)) return 'audio'
  return 'script'
}

type Fetcher = typeof fetch

async function request<T>(fetcher: Fetcher, path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  console.info('[motion-studio:ui] request', { step: 'begin', method, path })
  // Same-origin cookies, matching the rest of the app. A missing session is not a login error;
  // 404 is reserved for another workspace's ids.
  const res = await fetcher(`${MOTION_STUDIO_API_BASE}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) },
  })
  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }
  if (!res.ok) {
    const rec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
    const code = typeof rec.code === 'string' ? rec.code : 'REQUEST_FAILED'
    const message =
      res.status === 401
        ? 'Your session has ended. Refresh the page to sign in again.'
        : res.status === 404
          ? 'Project not found.'
          : typeof rec.error === 'string'
            ? rec.error
            : 'Motion Studio request failed.'
    console.info('[motion-studio:ui] request', { step: 'error', method, path, status: res.status, code })
    throw new MotionStudioHttpError(res.status, code, message)
  }
  console.info('[motion-studio:ui] request', { step: 'complete', method, path, status: res.status })
  return payload as T
}

const enc = encodeURIComponent
type P = { project: MsProject }

/** Live adapter against `/api/motion-studio/*` (spec ST-API-001). */
export function createLiveMotionStudioClient(opts: { fetcher?: Fetcher; upload?: MotionStudioClient['uploadFile'] } = {}): MotionStudioClient {
  const f: Fetcher = opts.fetcher ?? ((...a) => fetch(...a))
  const post = (path: string, body?: unknown, key?: string) =>
    request<P>(f, path, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
      headers: key ? { 'Idempotency-Key': key } : undefined,
    }).then((r) => r.project)
  return {
    mode: 'live',
    listProjects: () => request<{ projects: MsProjectSummary[] }>(f, '/projects').then((r) => r.projects),
    createProject: (input) => post('/projects', input, input.idempotencyKey),
    getProject: (id) => request<P>(f, `/projects/${enc(id)}`).then((r) => r.project),
    updateProject: (id, patch) =>
      request<P>(f, `/projects/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.project),
    createPlan: (id, key) => post(`/projects/${enc(id)}/plan`, { idempotencyKey: key }, key),
    startProduction: (id, mode, key) => post(`/projects/${enc(id)}/run`, { mode, idempotencyKey: key }, key),
    approveStory: (id) => post(`/projects/${enc(id)}/story/approve`),
    requestStoryChanges: (id, note) => post(`/projects/${enc(id)}/story/changes`, { note }),
    listActivity: (id, after) =>
      request<{ events: MsActivityEvent[]; cursor: string | null }>(
        f,
        `/projects/${enc(id)}/activity${after ? `?after=${enc(after)}` : ''}`,
      ),
    listAssets: (id) => request<{ assets: MsAsset[] }>(f, `/projects/${enc(id)}/assets`).then((r) => r.assets),
    addAssets: (id, uploads) => post(`/projects/${enc(id)}/assets`, { uploads }),
    replaceAsset: (id, assetId, withAssetId) => post(`/projects/${enc(id)}/assets/${enc(assetId)}/replace`, { withAssetId }),
    updateScene: (id, sceneId, patch) =>
      request<P>(f, `/projects/${enc(id)}/scenes/${enc(sceneId)}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(
        (r) => r.project,
      ),
    regenerateScene: (id, sceneId, instruction, key) =>
      post(`/projects/${enc(id)}/scenes/${enc(sceneId)}/regenerate`, { instruction, idempotencyKey: key }, key),
    sendDirectorMessage: (id, message, sceneId) => post(`/projects/${enc(id)}/director`, { message, sceneId: sceneId ?? null }),
    decideProposal: (id, proposalId, itemIds, decision) =>
      post(`/projects/${enc(id)}/proposals/${enc(proposalId)}/${decision}`, { itemIds }),
    retryStage: (id, stage, key) => post(`/projects/${enc(id)}/steps/${enc(stage)}/retry`, { idempotencyKey: key }, key),
    getAllowance: (id) => request<{ allowance: MsAllowance }>(f, `/projects/${enc(id)}/allowance`).then((r) => r.allowance),
    startExport: (id, key) => post(`/projects/${enc(id)}/export`, { idempotencyKey: key }, key),
    cancelProject: (id) => post(`/projects/${enc(id)}/cancel`),
    getExportDownload: (id) => request<{ url: string; filename: string }>(f, `/projects/${enc(id)}/export/download`),
    openInEditor: (id) =>
      request<MsEditorHandoff>(f, `/projects/${enc(id)}/open-in-editor`, { method: 'POST', body: '{}' }),
    uploadFile:
      opts.upload ??
      (async (file, onProgress) => {
        // Reuse the existing clips upload path and limits (ST-UX-007).
        const { uploadClipFile } = await import('../clips/upload')
        return uploadClipFile(file, (p) => onProgress(p.percent), { kind: 'media' })
      }),
  }
}

export function newIdempotencyKey(prefix = 'ms'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}_${rand}`
}

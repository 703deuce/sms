import type {
  StudioAssetSlot,
  StudioAspect,
  StudioJob,
  StudioJobStatus,
  StudioMediaKind,
  StudioMode,
  StudioModel,
} from './contract'
import {
  DEFAULT_STUDIO_HISTORY_LIMIT,
  DEFAULT_STUDIO_POLL_MS,
  STUDIO_DEFAULT_IMAGE_MODEL_ID,
  STUDIO_DEFAULT_VIDEO_MODEL_ID,
} from './contract'
import type { StudioClient } from './client'
import { createStudioClient } from './client'
import type { StudioUiError } from './errors'
import { mapStudioJobError, toStudioUiError } from './errors'
import { editorProjectHref, formatCredits, generateButtonLabel, snapDuration } from './format'
import { listEditorProjectsForStudio, type EditorProjectOption } from './projects'
import type { StudioBackend } from './fallback'

export type LocalAsset = {
  file: Blob
  name: string
  type: string
  previewUrl?: string
  assetId?: string
}

export type GenerateForm = {
  modelId: string
  mode: StudioMode
  prompt: string
  aspect: StudioAspect | null
  durationSec: number | null
  resolution: string | null
  assets: Partial<Record<StudioAssetSlot, LocalAsset>>
  projectId: string | null
}

export type HistoryFilter = {
  kind: 'all' | StudioMediaKind
  modelId: string | null
  status: StudioJobStatus | null
}

export type GeneratePhase = 'idle' | 'submitting' | 'polling' | 'done' | 'failed'

export type StudioSessionState = {
  transport: 'api' | 'dev-fallback' | 'pending'
  modelsStatus: 'loading' | 'ready' | 'error'
  models: StudioModel[]
  modelsError: StudioUiError | null
  form: GenerateForm
  phase: GeneratePhase
  submitLocked: boolean
  canSubmit: boolean
  submitBlockedReason: string | null
  creditEstimate: number
  creditLabel: string
  generateLabel: string
  activeJob: StudioJob | null
  history: StudioJob[]
  nextCursor: string | null
  historyStatus: 'idle' | 'loading' | 'error'
  historyError: StudioUiError | null
  historyFilter: HistoryFilter
  historyView: 'grid' | 'list'
  resultsView: 'history' | 'models'
  detailJobId: string | null
  lastError: StudioUiError | null
  sendError: StudioUiError | null
  sendResult: { projectId: string; clipId: string; href: string } | null
  sendingJobId: string | null
  projects: EditorProjectOption[]
  projectsStatus: 'idle' | 'loading' | 'error'
}

export type StudioController = {
  subscribe(listener: () => void): () => void
  getState(): StudioSessionState
  load(): Promise<void>
  setKind(kind: StudioMediaKind): void
  setMode(mode: StudioMode): void
  setModel(id: string): void
  setPrompt(prompt: string): void
  setAspect(aspect: StudioAspect): void
  setDurationSec(n: number): void
  setResolution(r: string): void
  setAsset(slot: StudioAssetSlot, file: File | Blob | null, meta?: { name?: string; type?: string }): void
  swapFrames(): void
  setResultsView(view: 'history' | 'models'): void
  generate(): Promise<{ ok: boolean; ignored?: boolean }>
  reuseSettings(job: StudioJob): void
  refreshHistory(): Promise<void>
  loadMoreHistory(): Promise<void>
  setHistoryFilter(filter: Partial<HistoryFilter>): void
  setHistoryView(view: 'grid' | 'list'): void
  openDetail(jobId: string | null): void
  loadProjects(): Promise<void>
  sendToTimeline(jobId: string, projectId: string, clipId?: string): Promise<{ ok: boolean; ignored?: boolean }>
  destroy(): void
}

function emptyForm(): GenerateForm {
  return {
    modelId: STUDIO_DEFAULT_VIDEO_MODEL_ID,
    mode: 'text_to_video',
    prompt: '',
    aspect: '16:9',
    durationSec: null,
    resolution: null,
    assets: {},
    projectId: null,
  }
}

export function selectedModel(models: StudioModel[], modelId: string): StudioModel | null {
  return models.find((m) => m.id === modelId) ?? null
}

export function pickDefaultModel(models: StudioModel[], kind: StudioMediaKind): StudioModel | null {
  const id = kind === 'image' ? STUDIO_DEFAULT_IMAGE_MODEL_ID : STUDIO_DEFAULT_VIDEO_MODEL_ID
  return models.find((m) => m.id === id) ?? models.find((m) => m.kind === kind) ?? models[0] ?? null
}

export function applyModelToForm(form: GenerateForm, model: StudioModel): GenerateForm {
  const mode = model.modes.includes(form.mode) ? form.mode : model.modes[0] ?? form.mode
  const aspect = form.aspect && model.aspects.includes(form.aspect) ? form.aspect : model.aspects[0] ?? null
  const durationSec =
    model.durationsSec.length === 0
      ? null
      : form.durationSec != null && model.durationsSec.includes(form.durationSec)
        ? form.durationSec
        : model.durationsSec[0]
  const resolution =
    model.resolutions.length === 0
      ? null
      : form.resolution && model.resolutions.includes(form.resolution)
        ? form.resolution
        : model.resolutions[0]
  const assets = { ...form.assets }
  if (!model.supportsReferenceImage) delete assets.reference
  if (!model.supportsStartEndFrame) {
    delete assets.start_frame
    delete assets.end_frame
  }
  return { ...form, modelId: model.id, mode, aspect, durationSec, resolution, assets }
}

export function validateGenerate(form: GenerateForm, model: StudioModel | null): string | null {
  if (!model) return 'Pick a model to generate.'
  if (!form.prompt.trim()) return 'Enter a prompt to generate.'
  if (!model.modes.includes(form.mode)) return 'This model doesn’t support that mode. Pick another mode or model.'
  if (form.mode === 'image_to_video' && !form.assets.reference && !form.assets.start_frame) {
    return 'Image to video needs a reference or start frame.'
  }
  if (form.aspect && model.aspects.length && !model.aspects.includes(form.aspect)) {
    return 'That aspect ratio isn’t available for this model.'
  }
  if (form.durationSec != null && model.durationsSec.length && !model.durationsSec.includes(form.durationSec)) {
    return 'That duration isn’t available for this model.'
  }
  if (form.resolution && model.resolutions.length && !model.resolutions.includes(form.resolution)) {
    return 'That quality isn’t available for this model.'
  }
  return null
}

export function shouldPoll(job: StudioJob | null): boolean {
  return job?.status === 'queued' || job?.status === 'running'
}

export function visibleHistory(state: StudioSessionState): StudioJob[] {
  const { kind, modelId, status } = state.historyFilter
  return state.history.filter((job) => {
    const jobKind = job.mode === 'text_to_image' ? 'image' : 'video'
    if (kind !== 'all' && jobKind !== kind) return false
    if (modelId && job.modelId !== modelId) return false
    if (status && job.status !== status) return false
    return true
  })
}

function derive(state: StudioSessionState): StudioSessionState {
  const model = selectedModel(state.models, state.form.modelId)
  const creditEstimate = model?.creditEstimate ?? 0
  const reason =
    state.submitLocked
      ? state.phase === 'polling' || state.phase === 'submitting'
        ? 'A generation is already in progress.'
        : 'Please wait.'
      : validateGenerate(state.form, model)
  return {
    ...state,
    creditEstimate,
    creditLabel: formatCredits(creditEstimate),
    generateLabel: generateButtonLabel(creditEstimate),
    canSubmit: !state.submitLocked && !reason,
    submitBlockedReason: reason,
  }
}

function upsert(list: StudioJob[], job: StudioJob): StudioJob[] {
  const i = list.findIndex((j) => j.id === job.id)
  if (i < 0) return [job, ...list]
  const next = list.slice()
  next[i] = job
  return next
}

export type CreateStudioControllerOptions = {
  client?: StudioClient | StudioBackend
  fetch?: typeof fetch
  pollMs?: number
  sleep?: (ms: number) => Promise<void>
  listProjects?: () => Promise<EditorProjectOption[]>
}

export function createStudioController(opts: CreateStudioControllerOptions = {}): StudioController {
  const client = (opts.client ?? createStudioClient({ fetch: opts.fetch })) as StudioClient
  const pollMs = opts.pollMs ?? DEFAULT_STUDIO_POLL_MS
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const listProjects = opts.listProjects ?? (() => listEditorProjectsForStudio(opts.fetch ?? fetch))

  let state: StudioSessionState = derive({
    transport: 'pending',
    modelsStatus: 'loading',
    models: [],
    modelsError: null,
    form: emptyForm(),
    phase: 'idle',
    submitLocked: false,
    canSubmit: false,
    submitBlockedReason: 'Loading models…',
    creditEstimate: 0,
    creditLabel: formatCredits(0),
    generateLabel: generateButtonLabel(0),
    activeJob: null,
    history: [],
    nextCursor: null,
    historyStatus: 'idle',
    historyError: null,
    historyFilter: { kind: 'all', modelId: null, status: null },
    historyView: 'grid',
    resultsView: 'history' as const,
    detailJobId: null,
    lastError: null,
    sendError: null,
    sendResult: null,
    sendingJobId: null,
    projects: [],
    projectsStatus: 'idle',
  })

  const listeners = new Set<() => void>()
  let generation = 0
  let disposed = false
  const sending = new Set<string>()

  function emit(patch: Partial<StudioSessionState>) {
    state = derive({ ...state, ...patch })
    for (const l of listeners) l()
  }

  function readTransport(): StudioSessionState['transport'] {
    return typeof (client as StudioClient).transport === 'function'
      ? (client as StudioClient).transport()
      : 'api'
  }

  const api: StudioController = {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getState: () => state,
    async load() {
      emit({ modelsStatus: state.models.length ? 'ready' : 'loading', modelsError: null })
      try {
        const [registry] = await Promise.all([
          client.listModels(),
          api.refreshHistory(),
        ])
        if (disposed) return
        const models = registry.models
        const current = selectedModel(models, state.form.modelId) ?? pickDefaultModel(models, 'video')
        emit({
          transport: readTransport(),
          modelsStatus: 'ready',
          models,
          modelsError: null,
          form: current ? applyModelToForm(state.form, current) : state.form,
        })
      } catch (e) {
        if (disposed) return
        emit({
          transport: readTransport(),
          modelsStatus: 'error',
          modelsError: toStudioUiError(e),
        })
      }
    },
    setKind(kind) {
      const model = pickDefaultModel(state.models, kind)
      if (!model) return
      emit({ form: applyModelToForm(state.form, model), lastError: null })
    },
    setMode(mode) {
      let form = { ...state.form, mode }
      const current = selectedModel(state.models, state.form.modelId)
      if (!current?.modes.includes(mode)) {
        const next = state.models.find((m) => m.modes.includes(mode))
        if (next) form = { ...applyModelToForm(form, next), mode }
      }
      emit({ form, lastError: null })
    },
    setModel(id) {
      const model = selectedModel(state.models, id)
      if (!model) return
      emit({ form: applyModelToForm(state.form, model), lastError: null })
    },
    setPrompt(prompt) {
      emit({ form: { ...state.form, prompt } })
    },
    setAspect(aspect) {
      emit({ form: { ...state.form, aspect } })
    },
    setDurationSec(n) {
      const model = selectedModel(state.models, state.form.modelId)
      const durationSec = model?.durationsSec.length ? snapDuration(n, model.durationsSec) : n
      emit({ form: { ...state.form, durationSec } })
    },
    setResolution(r) {
      emit({ form: { ...state.form, resolution: r } })
    },
    setAsset(slot, file, meta) {
      const assets = { ...state.form.assets }
      if (!file) {
        const prev = assets[slot]
        if (prev?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl)
        delete assets[slot]
      } else {
        const name = meta?.name || (file instanceof File ? file.name : 'upload')
        const type = meta?.type || file.type || ''
        const previewUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : undefined
        assets[slot] = { file, name, type, previewUrl }
      }
      emit({ form: { ...state.form, assets } })
    },
    async generate() {
      if (state.submitLocked) return { ok: false, ignored: true }
      const model = selectedModel(state.models, state.form.modelId)
      const reason = validateGenerate(state.form, model)
      if (reason || !model) {
        emit({ lastError: { kind: 'INVALID_PARAMS', code: 'INVALID_PARAMS', httpStatus: null, message: reason || 'Invalid options' } })
        return { ok: false }
      }
      const gen = ++generation
      emit({ submitLocked: true, phase: 'submitting', lastError: null })
      try {
        const form = state.form
        const assetIds: Partial<Record<StudioAssetSlot, string>> = {}
        for (const slot of ['reference', 'start_frame', 'end_frame'] as const) {
          const asset = form.assets[slot]
          if (!asset) continue
          if (asset.assetId) {
            assetIds[slot] = asset.assetId
            continue
          }
          const { id } = await client.uploadAsset(asset.file, slot, asset.name)
          assetIds[slot] = id
          if (disposed || gen !== generation) return { ok: false, ignored: true }
          const assets = { ...state.form.assets, [slot]: { ...asset, assetId: id } }
          emit({ form: { ...state.form, assets } })
        }
        const job = await client.createJob({
          modelId: model.id,
          mode: form.mode,
          prompt: form.prompt.trim(),
          ...(form.aspect ? { aspect: form.aspect } : {}),
          ...(form.durationSec != null ? { durationSec: form.durationSec } : {}),
          ...(form.resolution ? { resolution: form.resolution } : {}),
          ...(assetIds.reference ? { referenceAssetId: assetIds.reference } : {}),
          ...(assetIds.start_frame ? { startFrameAssetId: assetIds.start_frame } : {}),
          ...(assetIds.end_frame ? { endFrameAssetId: assetIds.end_frame } : {}),
          ...(form.projectId ? { projectId: form.projectId } : {}),
        })
        if (disposed || gen !== generation) return { ok: false, ignored: true }
        emit({
          transport: readTransport(),
          activeJob: job,
          history: upsert(state.history, job),
          detailJobId: job.id,
          phase: shouldPoll(job) ? 'polling' : job.status === 'failed' ? 'failed' : 'done',
          submitLocked: shouldPoll(job),
        })
        if (shouldPoll(job)) {
          while (!disposed && gen === generation) {
            await sleep(pollMs)
            if (disposed || gen !== generation) break
            const latest = await client.getJob(job.id)
            if (disposed || gen !== generation) break
            emit({
              activeJob: latest,
              history: upsert(state.history, latest),
              lastError:
                latest.status === 'failed' && latest.error ? mapStudioJobError(latest.error) : state.lastError,
              phase: shouldPoll(latest) ? 'polling' : latest.status === 'failed' ? 'failed' : 'done',
              submitLocked: shouldPoll(latest),
            })
            if (!shouldPoll(latest)) break
          }
        }
        return { ok: true }
      } catch (e) {
        if (disposed || gen !== generation) return { ok: false, ignored: true }
        emit({
          transport: readTransport(),
          phase: 'failed',
          submitLocked: false,
          lastError: toStudioUiError(e),
        })
        return { ok: false }
      } finally {
        if (gen === generation && !disposed && !shouldPoll(state.activeJob)) {
          emit({ submitLocked: false })
        }
      }
    },
    reuseSettings(job) {
      const model = selectedModel(state.models, job.modelId)
      const base = model ? applyModelToForm(state.form, model) : { ...state.form, modelId: job.modelId }
      emit({
        form: {
          ...base,
          mode: job.mode,
          prompt: job.prompt,
          aspect: job.aspect ?? base.aspect,
          durationSec: job.durationSec ?? base.durationSec,
          resolution: job.resolution ?? base.resolution,
          assets: {},
        },
        lastError: null,
        detailJobId: job.id,
        // Do not change phase / do not generate.
      })
    },
    async refreshHistory() {
      emit({ historyStatus: 'loading', historyError: null })
      try {
        const res = await client.listJobs({ limit: DEFAULT_STUDIO_HISTORY_LIMIT })
        if (disposed) return
        emit({
          transport: readTransport(),
          history: res.jobs,
          nextCursor: res.nextCursor,
          historyStatus: 'idle',
        })
      } catch (e) {
        if (disposed) return
        emit({
          transport: readTransport(),
          historyStatus: 'error',
          historyError: toStudioUiError(e),
        })
      }
    },
    async loadMoreHistory() {
      if (!state.nextCursor || state.historyStatus === 'loading') return
      emit({ historyStatus: 'loading' })
      try {
        const res = await client.listJobs({ limit: DEFAULT_STUDIO_HISTORY_LIMIT, cursor: state.nextCursor })
        if (disposed) return
        const seen = new Set(state.history.map((j) => j.id))
        emit({
          history: [...state.history, ...res.jobs.filter((j) => !seen.has(j.id))],
          nextCursor: res.nextCursor,
          historyStatus: 'idle',
        })
      } catch (e) {
        if (disposed) return
        emit({ historyStatus: 'error', historyError: toStudioUiError(e) })
      }
    },
    setHistoryFilter(filter) {
      emit({ historyFilter: { ...state.historyFilter, ...filter } })
    },
    setHistoryView(view) {
      emit({ historyView: view })
    },
    setResultsView(view) {
      emit({ resultsView: view })
    },
    swapFrames() {
      const assets = { ...state.form.assets }
      const start = assets.start_frame
      const end = assets.end_frame
      if (start) assets.end_frame = start
      else delete assets.end_frame
      if (end) assets.start_frame = end
      else delete assets.start_frame
      emit({ form: { ...state.form, assets } })
    },
    openDetail(jobId) {
      emit({ detailJobId: jobId, sendError: null, sendResult: null })
    },
    async loadProjects() {
      emit({ projectsStatus: 'loading' })
      try {
        const projects = await listProjects()
        if (disposed) return
        emit({ projects, projectsStatus: 'idle' })
      } catch (e) {
        if (disposed) return
        emit({ projectsStatus: 'error', sendError: toStudioUiError(e) })
      }
    },
    async sendToTimeline(jobId, projectId, clipId) {
      if (sending.has(jobId)) return { ok: false, ignored: true }
      sending.add(jobId)
      emit({ sendingJobId: jobId, sendError: null, sendResult: null })
      try {
        const res = await client.sendToTimeline(jobId, { projectId, ...(clipId ? { clipId } : {}) })
        if (disposed) return { ok: false, ignored: true }
        emit({
          sendingJobId: null,
          sendResult: { projectId: res.projectId, clipId: res.clipId, href: editorProjectHref(res.projectId, res.clipId) },
        })
        return { ok: true }
      } catch (e) {
        if (disposed) return { ok: false, ignored: true }
        emit({ sendingJobId: null, sendError: toStudioUiError(e) })
        return { ok: false }
      } finally {
        sending.delete(jobId)
      }
    },
    destroy() {
      disposed = true
      generation += 1
      listeners.clear()
    },
  }

  return api
}

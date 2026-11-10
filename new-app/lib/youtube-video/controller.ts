import {
  DEFAULT_YOUTUBE_VIDEO_POLL_MS,
  YOUTUBE_VIDEO_MAX_SOURCES,
  type CreateYoutubeVideoBody,
  type YoutubeVideoRun,
  type YoutubeVideoSource,
} from './contract'
import { createYoutubeVideoClient, type YoutubeVideoClient } from './client'
import { creditLabel, sanitizeYoutubeVideoMessage } from './format'
import { YoutubeVideoHttpError } from './parse'

export type YoutubeVideoPhase =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'choosing'
  | 'reverting'
  | 'done'
  | 'failed'

export type YoutubeVideoSessionState = {
  phase: YoutubeVideoPhase
  submitLocked: boolean
  clientRequestId: string | null
  title: string
  sources: YoutubeVideoSource[]
  run: YoutubeVideoRun | null
  creditLabel: string | null
  error: { code: string; message: string } | null
  chooseError: string | null
  confirmRevert: boolean
}

export type CreateYoutubeVideoControllerOptions = {
  client?: YoutubeVideoClient
  fetch?: typeof fetch
  pollMs?: number
  sleep?: (ms: number) => Promise<void>
  randomId?: () => string
}

function emptyState(): YoutubeVideoSessionState {
  return {
    phase: 'idle',
    submitLocked: false,
    clientRequestId: null,
    title: '',
    sources: [],
    run: null,
    creditLabel: null,
    error: null,
    chooseError: null,
    confirmRevert: false,
  }
}

function withRun(state: YoutubeVideoSessionState, run: YoutubeVideoRun | null): YoutubeVideoSessionState {
  const phase: YoutubeVideoPhase =
    run?.status === 'done' ? 'done' : run?.status === 'failed' ? 'failed' : run ? 'polling' : state.phase
  return {
    ...state,
    run,
    creditLabel: creditLabel(run),
    phase: state.phase === 'submitting' || state.phase === 'choosing' || state.phase === 'reverting' ? state.phase : phase,
    error: run?.status === 'failed' ? run.error ?? state.error : run ? null : state.error,
  }
}

function toError(e: unknown): { code: string; message: string } {
  if (e instanceof YoutubeVideoHttpError) return { code: e.code, message: e.message }
  if (e instanceof Error) return { code: 'ERROR', message: sanitizeYoutubeVideoMessage(e.message) }
  return { code: 'ERROR', message: 'Something went wrong.' }
}

function mintId(randomId?: () => string): string {
  if (randomId) return randomId()
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `ytv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export type YoutubeVideoController = {
  subscribe: (listener: () => void) => () => void
  getState: () => YoutubeVideoSessionState
  setTitle: (title: string) => void
  setSources: (sources: YoutubeVideoSource[]) => void
  submit: (input?: { sources?: YoutubeVideoSource[]; title?: string }) => Promise<void>
  retry: () => Promise<void>
  choose: (optionId: string) => Promise<void>
  refresh: () => Promise<void>
  requestRevert: () => void
  cancelRevert: () => void
  confirmRevert: () => Promise<void>
  refetchPlayback: () => Promise<void>
  destroy: () => void
}

export function createYoutubeVideoController(
  opts: CreateYoutubeVideoControllerOptions = {},
): YoutubeVideoController {
  const client = opts.client ?? createYoutubeVideoClient({ fetch: opts.fetch })
  const pollMs = opts.pollMs ?? DEFAULT_YOUTUBE_VIDEO_POLL_MS
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  let state = emptyState()
  const listeners = new Set<() => void>()
  let disposed = false
  let generation = 0

  function emit(patch: Partial<YoutubeVideoSessionState>) {
    state = { ...state, ...patch }
    if (patch.run !== undefined) state = withRun({ ...state, phase: patch.phase ?? state.phase }, patch.run)
    if (patch.phase) state = { ...state, phase: patch.phase }
    for (const l of listeners) l()
  }

  async function pollUntilSettled(runId: string, gen: number) {
    emit({ phase: 'polling', submitLocked: false })
    while (!disposed && gen === generation) {
      const run = state.run
      if (run && (run.status === 'done' || run.status === 'failed')) {
        emit({
          phase: run.status,
          run,
          error: run.status === 'failed' ? run.error ?? { code: 'ERROR', message: 'Generation failed.' } : null,
        })
        return
      }
      await sleep(pollMs)
      if (disposed || gen !== generation) return
      try {
        const next = await client.getRun(runId)
        if (disposed || gen !== generation) return
        emit({ run: next })
      } catch (e) {
        if (disposed || gen !== generation) return
        emit({ phase: 'failed', error: toError(e), submitLocked: false })
        return
      }
    }
  }

  async function startRun(sources: YoutubeVideoSource[], title: string, clientRequestId: string) {
    if (sources.length < 1 || sources.length > YOUTUBE_VIDEO_MAX_SOURCES) {
      emit({
        phase: 'failed',
        submitLocked: false,
        error: {
          code: 'INVALID_SOURCES',
          message: `Add between 1 and ${YOUTUBE_VIDEO_MAX_SOURCES} sources.`,
        },
      })
      return
    }
    const gen = ++generation
    const body: CreateYoutubeVideoBody = { sources, clientRequestId }
    const trimmed = title.trim()
    if (trimmed) body.title = trimmed
    emit({
      phase: 'submitting',
      submitLocked: true,
      error: null,
      chooseError: null,
      confirmRevert: false,
      sources,
      title,
      clientRequestId,
    })
    try {
      const run = await client.createRun(body)
      if (disposed || gen !== generation) return
      emit({ run, submitLocked: false, phase: 'polling' })
      await pollUntilSettled(run.runId, gen)
    } catch (e) {
      if (disposed || gen !== generation) return
      emit({ phase: 'failed', submitLocked: false, error: toError(e) })
    }
  }

  const api: YoutubeVideoController = {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getState: () => state,
    setTitle(title) {
      emit({ title })
    },
    setSources(sources) {
      // A changed source list is a new submit attempt.
      emit({ sources, clientRequestId: null })
    },
    async submit(input) {
      if (state.submitLocked) return
      const sources = input?.sources ?? state.sources
      const title = input?.title ?? state.title
      const clientRequestId = state.clientRequestId ?? mintId(opts.randomId)
      await startRun(sources, title, clientRequestId)
    },
    async retry() {
      if (state.submitLocked) return
      if (!state.sources.length) return
      const clientRequestId = state.clientRequestId ?? mintId(opts.randomId)
      await startRun(state.sources, state.title, clientRequestId)
    },
    async choose(optionId) {
      if (!state.run || state.submitLocked) return
      const gen = generation
      emit({ phase: 'choosing', chooseError: null, submitLocked: true })
      try {
        const run = await client.chooseOption(state.run.runId, optionId)
        if (disposed || gen !== generation) return
        emit({ run, submitLocked: false, chooseError: null, phase: 'polling' })
        await pollUntilSettled(run.runId, gen)
      } catch (e) {
        if (disposed || gen !== generation) return
        if (e instanceof YoutubeVideoHttpError && e.status === 409) {
          emit({
            submitLocked: false,
            chooseError:
              e.message || 'A different option was already chosen. Refreshing the run.',
          })
          try {
            const run = await client.getRun(state.run.runId)
            if (disposed || gen !== generation) return
            emit({ run, phase: 'polling' })
            await pollUntilSettled(run.runId, gen)
          } catch (refreshErr) {
            if (disposed || gen !== generation) return
            emit({ phase: 'failed', error: toError(refreshErr) })
          }
          return
        }
        emit({ submitLocked: false, phase: 'polling', chooseError: toError(e).message })
      }
    },
    async refresh() {
      if (!state.run) return
      const run = await client.getRun(state.run.runId)
      if (disposed) return
      emit({ run })
    },
    requestRevert() {
      if (!state.run || state.run.status !== 'done') return
      emit({ confirmRevert: true })
    },
    cancelRevert() {
      emit({ confirmRevert: false })
    },
    async confirmRevert() {
      if (!state.run || !state.confirmRevert || state.submitLocked) return
      const gen = generation
      emit({ phase: 'reverting', submitLocked: true, confirmRevert: false, error: null })
      try {
        const run = await client.revertRun(state.run.runId)
        if (disposed || gen !== generation) return
        emit({ run, submitLocked: false, phase: 'polling' })
        await pollUntilSettled(run.runId, gen)
      } catch (e) {
        if (disposed || gen !== generation) return
        emit({ phase: 'failed', submitLocked: false, error: toError(e) })
      }
    },
    async refetchPlayback() {
      if (!state.run) return
      try {
        const run = await client.getRun(state.run.runId)
        if (disposed) return
        emit({ run })
      } catch {
        /* keep the current run; the player can retry */
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

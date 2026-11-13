import type { YoutubeVideoCreateInput, YoutubeVideoRunView, YoutubeVideoSource } from '../youtube-video/types'
import { createYoutubeVideoClient, type YoutubeVideoClient } from './client'
import { creditLabel, sanitizeYoutubeVideoMessage } from './format'
import { DEFAULT_YOUTUBE_VIDEO_POLL_MS, YOUTUBE_VIDEO_MAX_SOURCES } from './paths'
import { YoutubeVideoHttpError } from './parse'

export type YoutubeVideoPhase =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'awaiting_choice'
  | 'needs_review'
  | 'choosing'
  | 'reverting'
  | 'ready'
  | 'failed'

export type YoutubeVideoSessionState = {
  phase: YoutubeVideoPhase
  submitLocked: boolean
  clientRequestId: string | null
  title: string
  sources: YoutubeVideoSource[]
  run: YoutubeVideoRunView | null
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

function phaseFromRun(run: YoutubeVideoRunView | null, fallback: YoutubeVideoPhase): YoutubeVideoPhase {
  if (!run) return fallback
  if (run.status === 'ready') return 'ready'
  if (run.status === 'failed' || run.status === 'canceled') return 'failed'
  if (run.status === 'awaiting_choice') return 'awaiting_choice'
  if (run.status === 'needs_review') return 'needs_review'
  return 'polling'
}

function settled(run: YoutubeVideoRunView | null): boolean {
  return !!run && (run.status === 'ready' || run.status === 'failed' || run.status === 'canceled' || run.status === 'awaiting_choice' || run.status === 'needs_review')
}

const MAX_RECONNECT_GET_ATTEMPTS = 3

function recoverableRunReadError(e: unknown): boolean {
  if (!(e instanceof YoutubeVideoHttpError)) return true
  return [408, 425, 429, 500, 502, 503, 504].includes(e.status)
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
  renderAnyway: () => Promise<void>
  refresh: () => Promise<void>
  restoreRun: (runId: string) => Promise<void>
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

  async function getRunWithRecovery(
    runId: string,
    gen: number,
    context: 'poll' | 'restore' | 'choice' | 'refresh',
  ): Promise<YoutubeVideoRunView | null> {
    let lastError: unknown
    for (let attempt = 1; attempt <= MAX_RECONNECT_GET_ATTEMPTS; attempt += 1) {
      try {
        return await client.getRun(runId)
      } catch (e) {
        lastError = e
        if (!recoverableRunReadError(e) || attempt === MAX_RECONNECT_GET_ATTEMPTS) throw e
        console.info('[youtube-video:client]', {
          event: 'run_get_reconnect',
          runId,
          context,
          attempt,
          errorCode: e instanceof YoutubeVideoHttpError ? e.code : 'NETWORK_ERROR',
        })
        await sleep(pollMs)
        if (disposed || gen !== generation) return null
      }
    }
    throw lastError
  }

  function emit(patch: Partial<YoutubeVideoSessionState>) {
    const previousPhase = state.phase
    const previousStatus = state.run?.status ?? null
    state = { ...state, ...patch }
    if (patch.run !== undefined) {
      const nextPhase = phaseFromRun(patch.run, state.phase)
      const keep =
        state.phase === 'submitting' || state.phase === 'choosing' || state.phase === 'reverting'
      state = {
        ...state,
        creditLabel: creditLabel(patch.run),
        phase: keep && patch.phase == null ? state.phase : (patch.phase ?? nextPhase),
        error:
          patch.run?.status === 'failed'
            ? {
                code: patch.run.failureCode ?? 'ERROR',
                message: patch.run.failureMessage ?? 'Generation failed.',
              }
            : patch.run
              ? null
              : state.error,
      }
    }
    const nextStatus = state.run?.status ?? null
    if (previousPhase !== state.phase || previousStatus !== nextStatus) {
      // Never log sources, signed media URLs, instructions, or transcript text.
      console.info('[youtube-video:client]', {
        event: 'phase_change', runId: state.run?.runId ?? null,
        from: previousPhase, to: state.phase,
        fromStatus: previousStatus, toStatus: nextStatus,
      })
    }
    for (const l of listeners) l()
  }

  async function pollUntilSettled(runId: string, gen: number, stopOnChoice = true) {
    emit({ phase: 'polling', submitLocked: false })
    while (!disposed && gen === generation) {
      const run = state.run
      if (run && (run.status === 'ready' || run.status === 'failed' || run.status === 'canceled' || (stopOnChoice && (run.status === 'awaiting_choice' || run.status === 'needs_review')))) {
        emit({
          phase: phaseFromRun(run, 'polling'),
          run,
          error:
            run.status === 'failed'
              ? { code: run.failureCode ?? 'ERROR', message: run.failureMessage ?? 'Generation failed.' }
              : null,
        })
        return
      }
      await sleep(pollMs)
      if (disposed || gen !== generation) return
      try {
        const next = await getRunWithRecovery(runId, gen, 'poll')
        if (!next || disposed || gen !== generation) return
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
    const body: YoutubeVideoCreateInput = { sources, clientRequestId }
    const trimmed = title.trim()
    if (trimmed) body.instruction = trimmed
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
      console.info('[youtube-video:client]', { event: 'run_create_request', sourceCount: sources.length })
      const run = await client.createRun(body, clientRequestId)
      if (disposed || gen !== generation) return
      console.info('[youtube-video:client]', { event: 'run_created', runId: run.runId, status: run.status })
      emit({ run, submitLocked: false, phase: settled(run) ? phaseFromRun(run, 'polling') : 'polling' })
      if (!settled(run)) await pollUntilSettled(run.runId, gen)
      else emit({ phase: phaseFromRun(run, 'polling'), run })
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
      const unchanged = JSON.stringify(state.sources) === JSON.stringify(sources)
      emit({ sources, ...(unchanged ? {} : { clientRequestId: null }) })
    },
    async submit(input) {
      if (state.submitLocked) return
      const sources = input?.sources ?? state.sources
      const title = input?.title ?? state.title
      const clientRequestId = state.clientRequestId ?? mintId(opts.randomId)
      // Lock synchronously so a double-click reuses the same attempt.
      state = { ...state, submitLocked: true, clientRequestId, sources, title }
      for (const l of listeners) l()
      await startRun(sources, title, clientRequestId)
    },
    async retry() {
      if (state.submitLocked) return
      if (!state.sources.length) return
      const clientRequestId = state.clientRequestId ?? mintId(opts.randomId)
      state = { ...state, submitLocked: true, clientRequestId }
      for (const l of listeners) l()
      await startRun(state.sources, state.title, clientRequestId)
    },
    async choose(optionId) {
      if (!state.run || state.submitLocked) return
      console.info('[youtube-video:client]', { event: 'choice_start', runId: state.run.runId, optionId })
      const gen = generation
      emit({ phase: 'choosing', chooseError: null, submitLocked: true })
      try {
        const run = await client.chooseOption(state.run.runId, optionId)
        if (disposed || gen !== generation) return
        console.info('[youtube-video:client]', { event: 'choice_response', runId: run.runId, status: run.status })
        emit({ run, submitLocked: false, chooseError: null, phase: 'polling' })
        if (run.status === 'ready' || run.status === 'failed' || run.status === 'canceled') {
          emit({ phase: phaseFromRun(run, 'polling'), run })
          return
        }
        await pollUntilSettled(run.runId, gen, false)
      } catch (e) {
        if (disposed || gen !== generation) return
        if (e instanceof YoutubeVideoHttpError && e.status === 409) {
          emit({
            submitLocked: false,
            chooseError: e.message || 'A different option was already chosen. Refreshing the run.',
          })
          try {
            const run = await getRunWithRecovery(state.run.runId, gen, 'choice')
            if (!run || disposed || gen !== generation) return
            emit({ run, phase: phaseFromRun(run, 'polling') })
            if (!settled(run) || run.status === 'awaiting_choice' && run.result) {
              /* already updated */
            }
            if (run.status !== 'awaiting_choice' && run.status !== 'ready' && run.status !== 'failed' && run.status !== 'canceled') {
              await pollUntilSettled(run.runId, gen, false)
            }
          } catch (refreshErr) {
            if (disposed || gen !== generation) return
            emit({ phase: 'failed', error: toError(refreshErr) })
          }
          return
        }
        if (recoverableRunReadError(e) && state.run) {
          const failedChoice = toError(e)
          try {
            const recovered = await getRunWithRecovery(state.run.runId, gen, 'choice')
            if (!recovered || disposed || gen !== generation) return
            const stillAwaitingChoice = recovered.status === 'awaiting_choice'
            console.info('[youtube-video:client]', {
              event: 'choice_reconnect_result',
              runId: recovered.runId,
              status: recovered.status,
              reposted: false,
            })
            emit({
              run: recovered,
              submitLocked: false,
              phase: phaseFromRun(recovered, stillAwaitingChoice ? 'awaiting_choice' : 'polling'),
              chooseError: stillAwaitingChoice ? failedChoice.message : null,
            })
            if (!stillAwaitingChoice && !settled(recovered)) {
              await pollUntilSettled(recovered.runId, gen, false)
            }
            return
          } catch {
            /* fall through; never repost a failed choice automatically */
          }
        }
        emit({ submitLocked: false, phase: 'awaiting_choice', chooseError: toError(e).message })
      }
    },
    async renderAnyway() {
      const runId=state.run?.runId
      if(!runId||state.run?.status!=='needs_review'||state.submitLocked)return
      const gen=generation
      emit({phase:'choosing',submitLocked:true,chooseError:null})
      try{
        await client.renderAnyway(runId)
        if(disposed||gen!==generation)return
        // Follow-up GET fetches the complete persisted run, not the minimal POST reply.
        const current=await getRunWithRecovery(runId,gen,'choice')
        if(!current||disposed||gen!==generation)return
        emit({run:current,submitLocked:false,phase:phaseFromRun(current,'polling')})
        if(!settled(current))await pollUntilSettled(runId,gen,false)
      }catch(error){
        if(disposed||gen!==generation)return
        emit({phase:'needs_review',submitLocked:false,chooseError:toError(error).message})
      }
    },
    async restoreRun(runId) {
      if (state.run?.runId === runId) return
      const gen = ++generation
      console.info('[youtube-video:client]', { event: 'restore_start', runId })
      emit({ phase: 'polling', submitLocked: false, error: null, chooseError: null })
      try {
        const run = await getRunWithRecovery(runId, gen, 'restore')
        if (!run || disposed || gen !== generation) return
        console.info('[youtube-video:client]', { event: 'restore_loaded', runId, status: run.status })
        emit({ run, phase: phaseFromRun(run, 'polling'), submitLocked: false })
        if (!settled(run)) await pollUntilSettled(runId, gen)
      } catch (e) {
        if (disposed || gen !== generation) return
        console.error('[youtube-video:client]', { event: 'restore_failed', runId,
          errorCode: e instanceof YoutubeVideoHttpError ? e.code : 'ERROR' })
        emit({ phase: 'failed', submitLocked: false, error: toError(e) })
      }
    },
    async refresh() {
      if (!state.run) return
      const gen = generation
      const run = await getRunWithRecovery(state.run.runId, gen, 'refresh')
      if (!run || disposed || gen !== generation) return
      emit({ run, phase: phaseFromRun(run, state.phase) })
    },
    requestRevert() {
      if (!state.run || state.run.status !== 'ready') return
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
        emit({ run, submitLocked: false, phase: phaseFromRun(run, 'ready') })
        if (run.status !== 'ready' && run.status !== 'failed' && run.status !== 'canceled') {
          await pollUntilSettled(run.runId, gen, false)
        }
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

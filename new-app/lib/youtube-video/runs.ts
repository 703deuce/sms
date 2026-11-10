import { createId } from '@/lib/supabase/id'
import { assembleChosenOption, ingestSources, prepareFromReadyYoutubeSources, type YoutubeVideoPipelineDeps } from '@/lib/youtube-video/pipeline'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
import { traceYoutubeRunStep, youtubeRunEvent } from '@/lib/youtube-video/step-log'
import type { YoutubeVideoRunRecord, YoutubeVideoRunStore } from '@/lib/youtube-video/run-store'
import { requestHash, resolveIdempotencyKey, validateCreateInput } from '@/lib/youtube-video/request'
import type {
  YoutubeVideoCreateInput,
  YoutubeVideoOption,
  YoutubeVideoResult,
  YoutubeVideoRunView,
} from '@/lib/youtube-video/types'

export type RevertClip = (input: { clipId: string; projectId: string }) => Promise<void>
export type WriteChosenClip = NonNullable<YoutubeVideoPipelineDeps['writeClip']>

export type YoutubeVideoRunDeps = {
  store: YoutubeVideoRunStore
  /** Check the durable RENDER_CLIP job and sign URLs only after outputKey exists. */
  resolveRender?: (workspaceId: string, renderId: string, runId: string) => Promise<{
    status: 'queued' | 'rendering' | 'ready' | 'failed'
    playbackUrl: string | null
    downloadUrl: string | null
    thumbnailUrl: string | null
    error?: string | null
  }>
  now?: () => Date
  pipeline: YoutubeVideoPipelineDeps
  writeClip: WriteChosenClip
  revertClip?: RevertClip
}

function view(record: YoutubeVideoRunRecord): YoutubeVideoRunView {
  return {
    runId: record.id,
    status: record.status,
    stage: record.stage,
    progressPercent: record.progressPercent,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    creditsEstimated: record.creditsEstimated,
    options: record.status === 'awaiting_choice' ? record.options : null,
    result: record.status === 'ready' ? record.result : null,
  }
}


const STALE_PLANNING_MS = 2 * 60_000

async function advanceRender(
  record: YoutubeVideoRunRecord, deps: YoutubeVideoRunDeps,
): Promise<YoutubeVideoRunRecord> {
  const renderId = record.result?.renderId
  if (!renderId || !deps.resolveRender) return record
  try {
    const progress = await traceYoutubeRunStep(record.id, 'render_status', () =>
      deps.resolveRender!(record.workspaceId, renderId, record.id),
      { projectId: record.result!.projectId },
    )
    if (progress.status === 'failed') {
      youtubeRunEvent(record.id, 'render_status', 'failed', { projectId: record.result!.projectId })
      return deps.store.update(record.workspaceId, record.id, {
        status: 'failed', stage: null,
        failureCode: 'render_failed',
        failureMessage: progress.error || 'Video rendering failed. Please try again.',
      })
    }
    if (progress.status !== 'ready') {
      youtubeRunEvent(record.id, 'render_status', 'waiting', {
        projectId: record.result!.projectId, status: progress.status,
      })
      return record
    }
    if (!progress.playbackUrl || !progress.downloadUrl) {
      youtubeRunEvent(record.id, 'render_status', 'url_pending', { projectId: record.result!.projectId })
      return record
    }
    youtubeRunEvent(record.id, 'render_status', 'ready', { projectId: record.result!.projectId })
    return deps.store.update(record.workspaceId, record.id, {
      status: 'ready', stage: null, progressPercent: 100,
      result: {
        ...record.result!,
        playbackUrl: progress.playbackUrl,
        downloadUrl: progress.downloadUrl,
        thumbnailUrl: progress.thumbnailUrl,
      },
    })
  } catch (err) {
    youtubeRunEvent(record.id, 'render_status', 'check_failed', {
      projectId: record.result!.projectId,
      errorCode: err instanceof YoutubeVideoError ? err.code : 'render_poll_failed',
    })
    // Storage/pooler transient errors must not make a completed clip disappear.
    return record
  }
}

async function maybeAutoPickOnlyStory(
  record: YoutubeVideoRunRecord, deps: YoutubeVideoRunDeps,
): Promise<YoutubeVideoRunRecord> {
  if (record.options?.length !== 1) return record
  youtubeRunEvent(record.id, 'story_choice', 'auto_pick_single_option', { optionCount: 1 })
  await chooseYoutubeVideoOption(record.workspaceId, record.id, record.options[0]!.id, deps)
  return (await deps.store.get(record.workspaceId, record.id)) ?? record
}

async function failRun(row: YoutubeVideoRunRecord, deps: YoutubeVideoRunDeps, err: unknown): Promise<YoutubeVideoRunRecord> {
  const code = err instanceof YoutubeVideoError ? err.code : 'pipeline_failed'
  youtubeRunEvent(row.id, 'run', 'failed', { errorCode: code })
  return deps.store.update(row.workspaceId, row.id, {
    status: 'failed', stage: null, progressPercent: null,
    failureCode: code,
    failureMessage: err instanceof Error ? err.message : 'Video preparation failed.',
  })
}

/** GET polling advances durable waiting runs. Never reimport an already mapped URL. */
async function advanceRun(
  record: YoutubeVideoRunRecord, deps: YoutubeVideoRunDeps, creating = false,
): Promise<YoutubeVideoRunRecord> {
  if (record.status === 'running' && record.stage === 'rendering') return advanceRender(record, deps)
  if (['ready', 'failed', 'canceled', 'awaiting_choice'].includes(record.status) || record.chosenOptionId) return record
  const staleBefore = new Date(Date.now() - STALE_PLANNING_MS).toISOString()
  if (record.status === 'running' && record.stage === 'planning' && record.updatedAt >= staleBefore) {
    youtubeRunEvent(record.id, 'planning', 'claimed_by_another_request')
    return record
  }
  if (record.status === 'importing' && !creating && record.updatedAt >= staleBefore) {
    youtubeRunEvent(record.id, 'importing', 'waiting_for_import')
    return record
  }

  let current = record
  try {
    // Persist the URL -> projectId mapping after every import to avoid duplicate
    // Twitch/Kick imports across source-readiness polls or web restarts.
    for (const [index, source] of current.sources.entries()) {
      if (source.kind !== 'url') continue
      current = await deps.store.update(current.workspaceId, current.id, {
        status: 'importing', stage: 'importing', progressPercent: 5,
      })
      const imported = await traceYoutubeRunStep(
        current.id, 'source_import',
        () => deps.pipeline.importer({ workspaceId: current.workspaceId, url: source.url }),
      )
      if (!imported.projectId) throw new YoutubeVideoError('import_failed', 'The source import did not create a project.', 500)
      current = await deps.store.update(current.workspaceId, current.id, {
        sources: current.sources.map((s, i) => i === index ? { kind: 'upload' as const, projectId: imported.projectId } : s),
      })
      youtubeRunEvent(current.id, 'source_import', 'project_created', { projectId: imported.projectId })
    }

    if (current.status !== 'waiting_for_source' && !(current.status === 'running' && current.stage === 'planning')) {
      current = await deps.store.update(current.workspaceId, current.id, {
        status: 'waiting_for_source', stage: 'waiting_for_source', progressPercent: 20,
      })
    }
    let ingested: Awaited<ReturnType<typeof ingestSources>>
    try {
      ingested = await traceYoutubeRunStep(
        current.id, 'source_readiness',
        () => ingestSources(current.workspaceId, current.sources, deps.pipeline),
        { sourceCount: current.sources.length },
      )
    } catch (err) {
      if (err instanceof YoutubeVideoError && err.code === 'source_not_ready') {
        youtubeRunEvent(current.id, 'source_wait', 'pending', {
          sourceCount: current.sources.length, status: 'waiting_for_source',
        })
        if (current.status !== 'waiting_for_source') {
          current = await deps.store.update(current.workspaceId, current.id, {
            status: 'waiting_for_source', stage: 'waiting_for_source', progressPercent: 20,
          })
        }
        return current
      }
      throw err
    }
    const claimed = await traceYoutubeRunStep(
      current.id, 'planning_claim',
      () => deps.store.claimPlanning(current.workspaceId, current.id, staleBefore),
    )
    if (!claimed) {
      youtubeRunEvent(current.id, 'planning', 'already_claimed')
      return (await deps.store.get(current.workspaceId, current.id)) ?? current
    }
    const prepared = await traceYoutubeRunStep(
      current.id, 'planning',
      () => prepareFromReadyYoutubeSources(ingested, deps.pipeline.proposeOptions),
      { sourceCount: ingested.length, wordCount: ingested.reduce((sum, source) => sum + source.words.length, 0) },
    )
    const planned = await traceYoutubeRunStep(
      current.id, 'story_options_saved',
      () => deps.store.update(current.workspaceId, current.id, {
        status: 'awaiting_choice', stage: null, progressPercent: 70,
        ingested: prepared.ingested, options: prepared.options, creditsEstimated: prepared.creditsEstimated,
      }),
      { optionCount: prepared.options.length },
    )
    return maybeAutoPickOnlyStory(planned, deps)
  } catch (err) {
    return failRun(current, deps, err)
  }
}

export async function createYoutubeVideoRun(
  workspaceId: string,
  createdById: string | null,
  raw: YoutubeVideoCreateInput,
  idempotencyHeader: string | null,
  deps: YoutubeVideoRunDeps,
): Promise<{ view: YoutubeVideoRunView; created: boolean }> {
  const input = await traceYoutubeRunStep('new', 'validation', () => validateCreateInput(raw))
  const clientRequestId = resolveIdempotencyKey(idempotencyHeader, input.clientRequestId)
  const hash = requestHash(input)
  const existing = await traceYoutubeRunStep('new', 'idempotency_lookup',
    () => deps.store.getByClientRequestId(workspaceId, clientRequestId))
  if (existing) {
    if (existing.requestHash !== hash) throw new YoutubeVideoError('idempotency_key_reuse', 'Idempotency key was already used with a different request', 409)
    youtubeRunEvent(existing.id, 'create', 'idempotent_replay', { status: existing.status })
    return { view: view(existing), created: false }
  }
  const active = await traceYoutubeRunStep('new', 'active_run_check', () => deps.store.findActive(workspaceId))
  if (active) throw new YoutubeVideoError('run_in_progress', 'A YouTube video run is already in progress', 409)
  const now = (deps.now ?? (() => new Date()))().toISOString()
  const hasUrl = input.sources.some((source) => source.kind === 'url')
  const record: YoutubeVideoRunRecord = {
    id: createId('yvrun'), workspaceId,
    status: hasUrl ? 'importing' : 'waiting_for_source',
    stage: hasUrl ? 'importing' : 'waiting_for_source',
    progressPercent: hasUrl ? 5 : 20,
    failureCode: null, failureMessage: null, instruction: input.instruction ?? null,
    clientRequestId, requestHash: hash, sources: input.sources, ingested: [],
    options: null, chosenOptionId: null, creditsEstimated: null, result: null,
    createdById, createdAt: now, updatedAt: now,
  }
  const created = await traceYoutubeRunStep(record.id, 'run_create', () => deps.store.create(record), { sourceCount: input.sources.length })
  return { view: view(await advanceRun(created, deps, true)), created: true }
}

export async function getYoutubeVideoRun(
  workspaceId: string, runId: string, deps: YoutubeVideoRunDeps,
): Promise<YoutubeVideoRunView> {
  const record = await traceYoutubeRunStep(runId, 'poll_read', () => deps.store.get(workspaceId, runId))
  if (!record) throw new YoutubeVideoError('not_found', 'Run not found', 404)
  youtubeRunEvent(runId, 'poll_decision', 'read', { status: record.status })
  const advanced = await advanceRun(record, deps)
  youtubeRunEvent(runId, 'poll_decision', 'return', { status: advanced.status })
  // Refresh expired browser signed URLs even for already-finished runs.
  if (advanced.status === 'ready' && advanced.result?.renderId && deps.resolveRender) {
    try {
      const media = await traceYoutubeRunStep(runId, 'ready_media_refresh', () =>
        deps.resolveRender!(workspaceId, advanced.result!.renderId!, runId))
      if (media.status === 'ready' && media.playbackUrl && media.downloadUrl) {
        return view({ ...advanced, result: {
          ...advanced.result!,
          playbackUrl: media.playbackUrl,
          downloadUrl: media.downloadUrl,
          thumbnailUrl: media.thumbnailUrl,
        } })
      }
    } catch (err) {
      youtubeRunEvent(runId, 'ready_media_refresh', 'retry_later', {
        errorCode: err instanceof YoutubeVideoError ? err.code : 'media_sign_failed',
      })
    }
  }
  return view(advanced)
}

export async function chooseYoutubeVideoOption(
  workspaceId: string,
  runId: string,
  optionId: string,
  deps: YoutubeVideoRunDeps,
): Promise<YoutubeVideoRunView> {
  if (!optionId?.trim()) throw new YoutubeVideoError('invalid_request', 'optionId is required', 400)
  const record = await deps.store.get(workspaceId, runId)
  if (!record) throw new YoutubeVideoError('not_found', 'Run not found', 404)
  if (record.chosenOptionId) {
    if (record.chosenOptionId === optionId) return view(record)
    throw new YoutubeVideoError('option_already_chosen', 'A different option was already chosen', 409)
  }
  if (record.status !== 'awaiting_choice' || !record.options?.length) {
    throw new YoutubeVideoError('choice_not_available', 'Story options are not available to choose yet', 409)
  }
  const option = record.options.find((item: YoutubeVideoOption) => item.id === optionId)
  if (!option) throw new YoutubeVideoError('invalid_request', 'optionId does not match an options[].id', 400)

  await traceYoutubeRunStep(runId, 'choice_validation', () => deps.store.update(workspaceId, runId, {
    status: 'running', stage: 'assembling', progressPercent: 80, chosenOptionId: optionId,
  }))
  try {
    const written = await traceYoutubeRunStep(runId, 'assembling', () =>
      (deps.pipeline.writeClip ?? deps.writeClip)({
        workspaceId, createdById: record.createdById, runId, option, sources: record.ingested,
      }), { sourceCount: record.ingested.length })
    const result: YoutubeVideoResult = await traceYoutubeRunStep(runId, 'applying', () => assembleChosenOption(option, written))
    if (written.renderId && deps.resolveRender) {
      // The renderer owns the real output. Do not claim video READY while it is
      // QUEUED / RENDERING and no signed MP4 URL exists yet.
      const waiting = await traceYoutubeRunStep(runId, 'render_wait_persist', () => deps.store.update(workspaceId, runId, {
        status: 'running', stage: 'rendering', progressPercent: 90,
        chosenOptionId: optionId, result,
      }), { projectId: result.projectId })
      return view(await advanceRender(waiting, deps))
    }
    const ready = await traceYoutubeRunStep(runId, 'result_ready', () => deps.store.update(workspaceId, runId, {
      status: 'ready', stage: null, progressPercent: 100,
      chosenOptionId: optionId, result,
    }))
    return view(ready)
  } catch (err) {
    const failureCode = err instanceof YoutubeVideoError ? err.code : 'apply_failed'
    const failureMessage = err instanceof Error ? err.message : 'apply failed'
    youtubeRunEvent(runId, 'assembling', 'failed', { errorCode: failureCode })
    await deps.store.update(workspaceId, runId, {
      status: 'failed',
      stage: null,
      failureCode,
      failureMessage,
      chosenOptionId: optionId,
    })
    throw err instanceof YoutubeVideoError ? err : new YoutubeVideoError('apply_failed', failureMessage, 500)
  }
}

export async function revertYoutubeVideoRun(
  workspaceId: string,
  runId: string,
  deps: YoutubeVideoRunDeps,
): Promise<YoutubeVideoRunView> {
  const record = await deps.store.get(workspaceId, runId)
  if (!record) throw new YoutubeVideoError('not_found', 'Run not found', 404)
  if (record.status !== 'ready' || !record.result) {
    throw new YoutubeVideoError('revert_not_available', 'Revert is only available on a ready run with a clip', 409)
  }
  if (!deps.revertClip) {
    throw new YoutubeVideoError('revert_not_available', 'Revert is not available', 409)
  }
  await traceYoutubeRunStep(runId, 'revert', () =>
    deps.revertClip!({ clipId: record.result!.clipId, projectId: record.result!.projectId }),
    { projectId: record.result.projectId },
  )
  return view(record)
}

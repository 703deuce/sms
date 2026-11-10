import { createId } from '@/lib/supabase/id'
import { assembleChosenOption, prepareYoutubeVideoRun, type YoutubeVideoPipelineDeps } from '@/lib/youtube-video/pipeline'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
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

export async function createYoutubeVideoRun(
  workspaceId: string,
  createdById: string | null,
  raw: YoutubeVideoCreateInput,
  idempotencyHeader: string | null,
  deps: YoutubeVideoRunDeps,
): Promise<{ view: YoutubeVideoRunView; created: boolean }> {
  const input = validateCreateInput(raw)
  const clientRequestId = resolveIdempotencyKey(idempotencyHeader, input.clientRequestId)
  const hash = requestHash(input)
  const existing = await deps.store.getByClientRequestId(workspaceId, clientRequestId)
  if (existing) {
    if (existing.requestHash !== hash) {
      throw new YoutubeVideoError('idempotency_key_reuse', 'Idempotency key was already used with a different request', 409)
    }
    return { view: view(existing), created: false }
  }
  const active = await deps.store.findActive(workspaceId)
  if (active) throw new YoutubeVideoError('run_in_progress', 'A YouTube video run is already in progress', 409)

  const now = (deps.now ?? (() => new Date))().toISOString()
  const record: YoutubeVideoRunRecord = {
    id: createId('yvrun'),
    workspaceId,
    status: input.sources.some((source) => source.kind === 'url') ? 'importing' : 'running',
    stage: input.sources.some((source) => source.kind === 'url') ? 'importing' : 'ingest',
    progressPercent: input.sources.some((source) => source.kind === 'url') ? 5 : 20,
    failureCode: null,
    failureMessage: null,
    instruction: input.instruction ?? null,
    clientRequestId,
    requestHash: hash,
    sources: input.sources,
    ingested: [],
    options: null,
    chosenOptionId: null,
    creditsEstimated: null,
    result: null,
    createdById,
    createdAt: now,
    updatedAt: now,
  }
  const created = await deps.store.create(record)
  try {
    await deps.store.update(workspaceId, created.id, {
      status: 'running',
      stage: 'planning',
      progressPercent: 50,
    })
    const prepared = await prepareYoutubeVideoRun(workspaceId, input, deps.pipeline)
    const readyForChoice = await deps.store.update(workspaceId, created.id, {
      status: 'awaiting_choice',
      stage: null,
      progressPercent: 70,
      ingested: prepared.ingested,
      options: prepared.options,
      creditsEstimated: prepared.creditsEstimated,
    })
    return { view: view(readyForChoice), created: true }
  } catch (err) {
    const failureCode = err instanceof YoutubeVideoError ? err.code : 'pipeline_failed'
    const failureMessage = err instanceof Error ? err.message : 'pipeline failed'
    const failed = await deps.store.update(workspaceId, created.id, {
      status: 'failed',
      stage: null,
      progressPercent: null,
      failureCode,
      failureMessage,
    })
    if (err instanceof YoutubeVideoError && (err.status === 400 || err.status === 409)) {
      // The run is stored as failed; still surface the request error to the caller.
      throw err
    }
    return { view: view(failed), created: true }
  }
}

export async function getYoutubeVideoRun(
  workspaceId: string,
  runId: string,
  deps: Pick<YoutubeVideoRunDeps, 'store'>,
): Promise<YoutubeVideoRunView> {
  const record = await deps.store.get(workspaceId, runId)
  if (!record) throw new YoutubeVideoError('not_found', 'Run not found', 404)
  return view(record)
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

  await deps.store.update(workspaceId, runId, {
    status: 'running',
    stage: 'assembling',
    progressPercent: 80,
    chosenOptionId: optionId,
  })
  try {
    const written = deps.pipeline.writeClip
      ? await deps.pipeline.writeClip({
          workspaceId,
          createdById: record.createdById,
          runId,
          option,
          sources: record.ingested,
        })
      : await deps.writeClip({
          workspaceId,
          createdById: record.createdById,
          runId,
          option,
          sources: record.ingested,
        })
    const result: YoutubeVideoResult = assembleChosenOption(option, written)
    const ready = await deps.store.update(workspaceId, runId, {
      status: 'ready',
      stage: null,
      progressPercent: 100,
      chosenOptionId: optionId,
      result,
    })
    return view(ready)
  } catch (err) {
    const failureCode = err instanceof YoutubeVideoError ? err.code : 'apply_failed'
    const failureMessage = err instanceof Error ? err.message : 'apply failed'
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
  await deps.revertClip({ clipId: record.result.clipId, projectId: record.result.projectId })
  return view(record)
}

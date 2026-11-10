import { createId } from '@/lib/supabase/id'
import { captionsRunCredits } from '@/lib/ai-captions/credits'
import { AiCaptionsError, assertNoDollar } from '@/lib/ai-captions/errors'
import { groupCaptionLines } from '@/lib/ai-captions/lines'
import {
  buildCaptionEdits,
  buildResult,
  captionsFromTranscript,
  loadOrTranscribe,
  type AiCaptionsPipelineDeps,
} from '@/lib/ai-captions/pipeline'
import { parseCreateBody, parseStyleBody } from '@/lib/ai-captions/request'
import type { AiCaptionsPrefs, AiCaptionsRunRecord, AiCaptionsRunStore } from '@/lib/ai-captions/run-store'
import { isKnownStyleId, resolveRequestedStyleId, type SavedCaptionStyle } from '@/lib/ai-captions/styles'
import type {
  AiCaptionsCreateView,
  AiCaptionsRunView,
  AiCaptionsStylesView,
  AiCaptionsStatus,
} from '@/lib/ai-captions/types'
import { AI_CAPTIONS_DEFAULT_STYLE_ID } from '@/lib/ai-captions/types'

export type AiCaptionsRunDeps = {
  store: AiCaptionsRunStore
  prefs: AiCaptionsPrefs
  pipeline: AiCaptionsPipelineDeps
  now?: () => Date
}

function nowIso(deps: AiCaptionsRunDeps): string {
  return (deps.now ?? (() => new Date()))().toISOString()
}

function toView(row: AiCaptionsRunRecord): AiCaptionsRunView {
  return {
    runId: row.id,
    status: row.status,
    stage: row.stage,
    progressPercent: row.progressPercent,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    creditEstimate: row.creditEstimate,
    styleId: row.styleId,
    projectId: row.ingestedProjectId ?? row.result?.projectId ?? (
      row.source.kind === 'project' || row.source.kind === 'asset' ? row.source.projectId : null
    ),
    result: row.result,
  }
}

function fail(row: AiCaptionsRunRecord, err: unknown): Partial<AiCaptionsRunRecord> {
  if (err instanceof AiCaptionsError) {
    return {
      status: 'failed',
      stage: row.stage,
      failureCode: err.code,
      failureMessage: assertNoDollar(err.message),
      progressPercent: row.progressPercent,
    }
  }
  return {
    status: 'failed',
    failureCode: 'caption_failed',
    failureMessage: assertNoDollar(err instanceof Error ? err.message : 'Caption run failed.'),
  }
}

async function savedStyles(workspaceId: string, deps: AiCaptionsRunDeps): Promise<SavedCaptionStyle[]> {
  return deps.pipeline.listSavedStyles(workspaceId)
}

export async function createAiCaptionsRun(
  workspaceId: string,
  createdById: string | null,
  body: unknown,
  headerKey: string | null,
  deps: AiCaptionsRunDeps,
): Promise<{ view: AiCaptionsCreateView; created: boolean }> {
  const parsed = parseCreateBody(body, headerKey)
  const existing = await deps.store.getByClientRequestId(workspaceId, parsed.clientRequestId)
  if (existing) {
    if (existing.requestHash !== parsed.requestHash) {
      throw new AiCaptionsError(
        'idempotency_key_reuse',
        'That idempotency key was already used with a different source or style.',
        409,
      )
    }
    return {
      view: { runId: existing.id, status: existing.status, creditEstimate: existing.creditEstimate ?? captionsRunCredits() },
      created: false,
    }
  }

  const creditEstimate = captionsRunCredits()
  const saved = await savedStyles(workspaceId, deps)
  const lastStyleId = await deps.prefs.getLastStyleId(workspaceId)
  const styleId = resolveRequestedStyleId(parsed.styleId, lastStyleId, saved)
  const ts = nowIso(deps)
  const row = await deps.store.create({
    id: createId('acr'),
    workspaceId,
    status: 'queued',
    stage: 'queued',
    progressPercent: 0,
    failureCode: null,
    failureMessage: null,
    clientRequestId: parsed.clientRequestId,
    requestHash: parsed.requestHash,
    source: parsed.source,
    ingestedProjectId: null,
    styleId,
    creditEstimate,
    result: null,
    createdById,
    createdAt: ts,
    updatedAt: ts,
  })

  const advanced = await advanceRun(row, deps)
  return {
    view: { runId: advanced.id, status: advanced.status, creditEstimate },
    created: true,
  }
}

export async function getAiCaptionsRun(
  workspaceId: string,
  runId: string,
  deps: AiCaptionsRunDeps,
): Promise<AiCaptionsRunView> {
  const row = await deps.store.get(workspaceId, runId)
  if (!row) throw new AiCaptionsError('run_not_found', 'That captions run was not found.', 404)
  const advanced = await advanceRun(row, deps)
  return toView(advanced)
}

async function advanceRun(row: AiCaptionsRunRecord, deps: AiCaptionsRunDeps): Promise<AiCaptionsRunRecord> {
  if (row.status === 'ready' || row.status === 'failed') return row
  if (row.status === 'exporting' && row.result) {
    try {
      const exported = await deps.pipeline.exportMp4({
        workspaceId: row.workspaceId,
        clipId: row.result.clipId,
        watermark: false,
      })
      if (exported.downloadUrl) {
        return deps.store.update(row.workspaceId, row.id, {
          status: 'ready',
          stage: 'ready',
          progressPercent: 100,
          result: { ...row.result, downloadUrl: exported.downloadUrl },
        })
      }
    } catch (err) {
      return deps.store.update(row.workspaceId, row.id, fail(row, err))
    }
    return row
  }

  try {
    let current = row
    if (current.source.kind === 'upload' && !current.ingestedProjectId) {
      current = await deps.store.update(current.workspaceId, current.id, {
        status: 'preparing',
        stage: 'prepare',
        progressPercent: 10,
      })
      const ingested = await deps.pipeline.ingestUpload(
        current.workspaceId,
        current.source.uploadId,
        current.createdById,
      )
      current = await deps.store.update(current.workspaceId, current.id, {
        ingestedProjectId: ingested.projectId,
        status: 'preparing',
        stage: 'prepare',
        progressPercent: 20,
      })
    } else if (current.source.kind !== 'upload' && !current.ingestedProjectId) {
      const projectId = current.source.projectId
      current = await deps.store.update(current.workspaceId, current.id, {
        ingestedProjectId: projectId,
        status: current.status === 'queued' ? 'transcribing' : current.status,
        stage: current.status === 'queued' ? 'transcribe' : current.stage,
        progressPercent: Math.max(current.progressPercent ?? 0, 20),
      })
    }

    if (current.status === 'queued' || current.status === 'preparing') {
      // For uploads, stay in preparing until the transcript exists; resolveSource will tell us.
      current = await deps.store.update(current.workspaceId, current.id, {
        status: current.source.kind === 'upload' ? 'preparing' : 'transcribing',
        stage: current.source.kind === 'upload' ? 'prepare' : 'transcribe',
        progressPercent: Math.max(current.progressPercent ?? 0, 25),
      })
    } else if (current.status === 'transcribing') {
      current = await deps.store.update(current.workspaceId, current.id, {
        status: 'transcribing',
        stage: 'transcribe',
        progressPercent: Math.max(current.progressPercent ?? 0, 30),
      })
    }

    const resolved = await loadOrTranscribe(
      current.workspaceId,
      current.source,
      deps.pipeline,
      current.ingestedProjectId,
    )
    const styleId = current.styleId || AI_CAPTIONS_DEFAULT_STYLE_ID
    const saved = await savedStyles(current.workspaceId, deps)
    current = await deps.store.update(current.workspaceId, current.id, {
      status: 'captioning',
      stage: 'captions',
      progressPercent: 70,
      styleId,
    })

    const durationMs = Math.max(resolved.durationMs, Math.round((resolved.words.at(-1)?.e ?? 0) * 1000))
    const built = captionsFromTranscript(durationMs, resolved.words, styleId, saved)
    const written = await deps.pipeline.writeClip({
      workspaceId: current.workspaceId,
      projectId: resolved.projectId,
      runId: current.id,
      durationMs,
      title: 'Captions',
      edits: built.edits,
    })
    const result = buildResult({
      runId: current.id,
      clipId: written.clipId,
      projectId: written.projectId,
      durationMs,
      styleId,
      words: built.words,
      lines: built.lines,
      playbackUrl: resolved.playbackUrl,
      thumbnailUrl: resolved.thumbnailUrl,
      downloadUrl: null,
    })
    await deps.prefs.setLastStyleId(current.workspaceId, styleId)
    return deps.store.update(current.workspaceId, current.id, {
      status: 'ready',
      stage: 'ready',
      progressPercent: 100,
      styleId,
      ingestedProjectId: current.ingestedProjectId ?? written.projectId,
      result,
    })
  } catch (err) {
    const pendingTranscript =
      err instanceof AiCaptionsError &&
      err.code === 'source_not_ready' &&
      err.message.includes('did not return any words')
    if (pendingTranscript) {
      const upload = row.source.kind === 'upload'
      return deps.store.update(row.workspaceId, row.id, {
        status: upload ? 'preparing' : 'transcribing',
        stage: upload ? 'prepare' : 'transcribe',
        progressPercent: upload ? 25 : 30,
        failureCode: null,
        failureMessage: null,
      })
    }
    const failed = await deps.store.update(row.workspaceId, row.id, fail(row, err))
    if (err instanceof AiCaptionsError) throw err
    return failed
  }
}

export async function listAiCaptionsStyles(
  workspaceId: string,
  deps: AiCaptionsRunDeps,
): Promise<AiCaptionsStylesView> {
  const { combineStyles } = await import('@/lib/ai-captions/styles')
  const saved = await savedStyles(workspaceId, deps)
  const lastStyleId = await deps.prefs.getLastStyleId(workspaceId)
  return {
    defaultStyleId: AI_CAPTIONS_DEFAULT_STYLE_ID,
    lastStyleId,
    styles: combineStyles(saved),
  }
}

export async function applyAiCaptionsStyle(
  workspaceId: string,
  runId: string,
  body: unknown,
  deps: AiCaptionsRunDeps,
): Promise<AiCaptionsRunView> {
  const { styleId } = parseStyleBody(body)
  const row = await deps.store.get(workspaceId, runId)
  if (!row) throw new AiCaptionsError('run_not_found', 'That captions run was not found.', 404)
  const saved = await savedStyles(workspaceId, deps)
  if (!isKnownStyleId(styleId, saved)) {
    throw new AiCaptionsError('unknown_style_id', 'That caption style is not available in this workspace.', 400)
  }
  if (row.status !== 'ready' && row.status !== 'captioning') {
    throw new AiCaptionsError('style_not_applicable', 'A style can be applied once captions are ready.', 409)
  }
  if (row.status === 'ready' && row.styleId === styleId && row.result) {
    return toView(row)
  }
  if (row.status !== 'ready' || !row.result) {
    throw new AiCaptionsError('style_not_applicable', 'A style can be applied once captions are ready.', 409)
  }

  const lines = row.result.lines
  const { bounds, edits } = buildCaptionEdits(row.result.durationMs, styleId, saved, lines)
  const updated = await deps.pipeline.updateClipEdits({
    clipId: row.result.clipId,
    bounds,
    baseVersion: 1,
    edits,
  })
  await deps.prefs.setLastStyleId(workspaceId, styleId)
  const next = await deps.store.update(workspaceId, runId, {
    styleId,
    result: { ...row.result, styleId },
  })
  void updated
  void bounds
  return toView(next)
}

export async function getAiCaptionsSrt(
  workspaceId: string,
  runId: string,
  deps: AiCaptionsRunDeps,
): Promise<string> {
  const { srtFromLines } = await import('@/lib/ai-captions/srt')
  const row = await deps.store.get(workspaceId, runId)
  if (!row) throw new AiCaptionsError('run_not_found', 'That captions run was not found.', 404)
  if (row.status !== 'ready' || !row.result) {
    throw new AiCaptionsError('srt_not_ready', 'The SRT file is not ready yet.', 409)
  }
  return srtFromLines(row.result.lines)
}

export async function exportAiCaptionsRun(
  workspaceId: string,
  runId: string,
  deps: AiCaptionsRunDeps,
): Promise<{ view: AiCaptionsRunView; queued: boolean }> {
  const row = await deps.store.get(workspaceId, runId)
  if (!row) throw new AiCaptionsError('run_not_found', 'That captions run was not found.', 404)
  if (row.status !== 'ready' && row.status !== 'exporting') {
    throw new AiCaptionsError('export_not_ready', 'Export is only available after captions are ready.', 409)
  }
  if (!row.result) {
    throw new AiCaptionsError('export_not_ready', 'Export is only available after captions are ready.', 409)
  }
  if (row.result.downloadUrl) {
    return { view: toView(row), queued: false }
  }

  const exporting = await deps.store.update(workspaceId, runId, {
    status: 'exporting' as AiCaptionsStatus,
    stage: 'export',
    progressPercent: 90,
  })
  try {
    const exported = await deps.pipeline.exportMp4({
      workspaceId,
      clipId: exporting.result!.clipId,
      watermark: false,
    })
    const next = await deps.store.update(workspaceId, runId, {
      status: 'ready',
      stage: 'ready',
      progressPercent: 100,
      result: { ...exporting.result!, downloadUrl: exported.downloadUrl },
    })
    return { view: toView(next), queued: true }
  } catch (err) {
    await deps.store.update(workspaceId, runId, fail(exporting, err))
    throw err instanceof AiCaptionsError
      ? err
      : new AiCaptionsError('export_not_ready', assertNoDollar(err instanceof Error ? err.message : 'Export failed.'), 409)
  }
}

export { groupCaptionLines }

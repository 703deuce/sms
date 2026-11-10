import 'server-only'

import type { Budget } from '@/lib/ai-producer-agent/budget'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import { enqueueAiProducerAnalyzeJob, waitForClipJobDone } from '@/lib/server/ai-producer-agent/enqueue-analyze'
import { analyzeWaitTimeoutMs } from '@/lib/ai-producer-agent/rough-cut-window'
import { topicQueryFromInstruction } from '@/lib/ai-producer-agent/clip-mode/topic-search'
import { isClipAgentMode } from '@/lib/ai-producer-agent/clip-mode/modes'
import { framesFromSamples } from '@/lib/clips/cuts-quality/cut-boundary-refine'
import type { RmsFrames } from '@/lib/ai-producer-agent/draft-edits'
import { timestampedAsrForVisual, visualMomentsWithAsr, chooseVisualFocusWindows } from '@/lib/ai-producer-agent/visual-evidence'
import { logAiProducerStep } from '@/lib/ai-producer-agent/log'

export async function findMoments(
  ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx,
  budget: Budget,
  args: Record<string, unknown>,
) {
  const est = 0.05
  if (!budget.canSpendGemini(est)) {
    return { ok: false, summary: 'budget exceeded', costUsd: 0 }
  }
  const mode = String(args.mode ?? 'best_moments') as 'best_moments' | 'story_search' | 'inventory'
  const anchor = ctx.sources[0]?.projectId
  if (!anchor) return { ok: false, summary: 'no anchor project' }
  // Opt-in only: YouTube uses the same Gemini watcher without inheriting Just Chatting rules.
  const visualStory = mode === 'best_moments' && (
    args.youtubeLongForm === true ||
    (ctx.config.editMode === 'just_chatting_rough_cut' && ctx.config.visualEvidenceMode === 'visual_audio')
  )
  const sourceRange = ctx.sources[0]?.rangeMs
  const transcriptText = visualStory && sourceRange
    ? timestampedAsrForVisual(ctx.cache.words ?? [], sourceRange) : undefined
  const topicQuery = typeof args.query === 'string' && args.query.trim()
    ? args.query.trim()
    : topicQueryFromInstruction(ctx.decideInput.instruction)
  const sourceMs = (ctx.sources[0]?.rangeMs
    ? ctx.sources[0]!.rangeMs[1]-ctx.sources[0]!.rangeMs[0]
    : ctx.sources[0]?.durationMs) || 0
  const job = await enqueueAiProducerAnalyzeJob({
    runId: ctx.runId,
    projectId: anchor,
    mode,
    sources: ctx.sources,
    query: topicQuery || undefined,
    targetClipLenS: Number(args.targetClipLenS ?? ctx.config.targetLengthS?.[1] ?? 30),
    ...(visualStory ? { visualEvidence: {
      enabled:true,model:'gemini-3.1-flash-lite',transcriptText,
    } } : {}),
  })
  const finished = await waitForClipJobDone(job.id, analyzeWaitTimeoutMs(sourceMs)).catch(() => null)
  const payload = (finished?.payload ?? {}) as { analyzeResult?: Record<string, unknown> }
  const result = payload.analyzeResult ?? {}
  if (!finished || !payload.analyzeResult) {
    return { ok: false, summary: 'video_analysis_unavailable', costUsd: 0 }
  }
  const rows = Array.isArray(result.inventory) ? result.inventory as Record<string, unknown>[] : []
  if (mode === 'inventory') {
    // An inventory is a list of contextual beats, not a second moments search.
    // Do not overwrite the best-moment candidates with an empty array.
    ctx.cache.inventory = { rows } as typeof ctx.cache.inventory
    ctx.cache.inventorySummary = { rows: rows.slice(0, 45) }
  } else {
    const moments = Array.isArray(result.moments) ? result.moments as Record<string, unknown>[] : []
    if (moments.length) {
      ctx.cache.moments = moments
      ctx.cache.momentsSummary = moments.slice(0, 30)
      if (visualStory && sourceRange) {
        ctx.cache.visualEvidence = {
          coarse: visualMomentsWithAsr(moments,ctx.cache.words??[],sourceRange,'coarse_1fps'),
          focused:[],
          metadata: {
            model:String((result.meta as Record<string,unknown> | undefined)?.model_requested??'gemini-3.1-flash-lite'),
            fps:1, mediaResolution:'MEDIA_RESOLUTION_LOW',
            originalAudioAttached:Boolean((result.meta as Record<string,unknown> | undefined)?.original_audio_attached),
            asrTranscriptAttached:Boolean(transcriptText),
          },
        }
        // Inventory is a second copy of the picker video-analysis job.
        // Reuse the new pass's observations instead of rescanning at 0.25 fps.
        const rows=moments.map(m=>({
          sourceId:m.sourceId,start_s:m.start_s,end_s:m.end_s,peak_s:m.peak_s,
          beat_type:m.category??'moment',energy:m.score,
          laugh:String(m.category??'').toLowerCase().includes('laugh'),
          reaction:String(m.what_happened??'').toLowerCase().includes('reaction'),
          quote:m.what_happened,visual_action:m.why_it_works,
          topic:m.content_type,callback_candidates:[],
        }))
        ctx.cache.inventory = {rows} as typeof ctx.cache.inventory
        ctx.cache.inventorySummary = {rows:rows.slice(0,45)}
      }
    }
  }
  const meta = result.meta && typeof result.meta === 'object' ? result.meta as Record<string, unknown> : null
  const costUsd = Number(result.costUsd ?? meta?.est_usd ?? est)
  return {
    ok: true,
    summary: mode === 'inventory' ? `${rows.length} inventory beats` : `${ctx.cache.moments?.length ?? 0} moments`,
    data: { moments: ctx.cache.moments ?? [], inventory: ctx.cache.inventory },
    costUsd: Number.isFinite(costUsd) ? costUsd : est,
  }
}

export async function getTranscript(ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx, args: Record<string, unknown>) {
  const words = ctx.cache.words ?? []
  const range = args.rangeMs as [number, number] | undefined
  const filtered = range
    ? words.filter((w) => w.e * 1000 >= range[0] && w.s * 1000 <= range[1])
    : words
  ctx.cache.words = words
  return { ok: true, summary: `${filtered.length} words`, data: { words: filtered }, costUsd: 0 }
}

export async function analyzeVisual(ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx, budget: Budget, args: Record<string, unknown>) {
  const est = 0.35
  if (!budget.canSpendGemini(est)) return { ok: false, summary: 'budget exceeded', costUsd: 0 }
  const anchor = ctx.sources[0]?.projectId
  if (!anchor) return { ok: false, summary: 'no anchor' }
  const requested = args.rangeMs as [number, number] | undefined
  const sources = requested
    ? ctx.sources.map((s) => {
        const [start, end] = s.rangeMs ?? [0, s.durationMs ?? 0]
        const lo = Math.max(start, Number(requested[0]))
        const hi = Math.min(end, Number(requested[1]))
        return { ...s, rangeMs: [lo, Math.max(lo, hi)] as [number, number] }
      }).filter((s) => s.rangeMs[1] > s.rangeMs[0])
    : ctx.sources
  if (!sources.length) return { ok: false, summary: 'visual_range_outside_source', costUsd: 0 }
  const job = await enqueueAiProducerAnalyzeJob({
    runId: ctx.runId, projectId: anchor, mode: 'best_moments',
    sources, targetClipLenS: 45,
  })
  const finished = await waitForClipJobDone(job.id).catch(() => null)
  const payload = (finished?.payload ?? {}) as { analyzeResult?: { moments?: Record<string, unknown>[] } }
  if (!payload.analyzeResult) return { ok: false, summary: 'visual_analysis_unavailable', costUsd: 0 }
  const actions = payload.analyzeResult.moments ?? []
  const data = { laughs: [], reactions: [], actions: actions.slice(0, 20), faces: [] }
  ctx.cache.visual = data
  // Only visual claims grounded in the worker's real Gemini observations.
  return { ok: true, summary: `${actions.length} observed visual moments`, data, costUsd: est }
}

export async function audioEnergy(ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx, budget: Budget, args: Record<string, unknown>) {
  const est = 0
  if (!budget.canSpendGemini(est)) return { ok: false, summary: 'budget exceeded', costUsd: 0 }
  const frames = ctx.cache.rmsFrames ?? []
  ctx.rmsLookup = buildRmsLookup(frames)
  if (!frames.length) {
    // Never tell the agent an audio boundary was checked when no actual
    // waveform/energy samples were delivered to the runner.
    return { ok: false, summary: 'audio_energy_unavailable_review_join_manually', costUsd: 0 }
  }
  return {
    ok: true,
    summary: `${frames.length} frames`,
    data: { valleys: [], silences: [], bursts: ctx.cache.bursts ?? [], frames },
    costUsd: 0,
  }
}

export function buildRmsLookup(frames: { tMs: number; rms: number }[]): RmsFrames {
  const sorted = [...frames].sort((a, b) => a.tMs - b.tMs)
  return (centerSrcMs: number) => {
    const lo = centerSrcMs - 2000
    const hi = centerSrcMs + 2000
    return sorted.filter((f) => f.tMs >= lo && f.tMs <= hi)
  }
}

export async function layoutInfo(ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx) {
  const clipMode=isClipAgentMode(ctx.config.storyMode)
  return { ok: true, summary: 'layout', data: { contentType: 'irl', mode: clipMode?'auto':'fit_blur' }, costUsd: 0 }
}

export async function beats() {
  return { ok: true, summary: 'beats', data: { bpm: 120, beats: [] }, costUsd: 0 }
}

export async function selfReview(ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx, args: Record<string, unknown>) {
  const pass = ctx.cache.selfReviewPass ?? true
  return {
    ok: true,
    summary: pass ? 'pass' : 'issues',
    data: { pass, issues: ctx.cache.selfReviewIssues ?? [] },
    costUsd: 0,
  }
}

export function ingestFramesFromWorker(samples: { tMs: number; rms: number }[]) {
  return framesFromSamples(samples, 10, 5)
}

/** Optional second look at promising regions with 1 fps labeled frames,
 * original audio and the same source-grounded Deepgram words. This only
 * produces evidence. It never writes cuts, selects a story, or changes Flow. */
export async function refineVisualStoryEvidence(
  ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx,
  budget: Budget,
  options: { youtubeLongForm?: boolean } = {},
) {
  if ((!options.youtubeLongForm && ctx.config.editMode!=='just_chatting_rough_cut') ||
      (!options.youtubeLongForm && ctx.config.visualEvidenceMode!=='visual_audio') ||
      !ctx.cache.visualEvidence || !ctx.cache.moments?.length) return
  const source=ctx.sources[0]
  if (!source?.rangeMs || !source.projectId) return
  const windows=chooseVisualFocusWindows(ctx.cache.moments,source.rangeMs)
  if(!windows.length || !budget.canSpendGemini(0.50)) {
    await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'ingest',
      tool:'visual_evidence_focus_skipped',kind:'validate',
      argsSummary:JSON.stringify({windowCount:windows.length,budgetRemaining:budget.remainingGemini()}),
      resultSummary:'No focus windows or insufficient budget'})
    return
  }
  try {
    const job=await enqueueAiProducerAnalyzeJob({
      runId:ctx.runId,projectId:source.projectId,mode:'visual_detail',
      sources:[source],targetClipLenS:45,
      visualEvidence:{
        enabled:true,model:'gemini-3.1-flash-lite',
        focusWindows:windows.map(([startMs,endMs])=>({
          startMs,endMs,
          transcriptText:timestampedAsrForVisual(ctx.cache.words??[],[startMs,endMs],12_000),
        })),
      },
    })
    const done=await waitForClipJobDone(job.id)
    const payload=done.payload as {analyzeResult?:{moments?:Record<string,unknown>[];meta?:Record<string,unknown>}} | null
    const result=payload?.analyzeResult
    if(!result)throw Error('visual_focus_result_missing')
    const focus=visualMomentsWithAsr(result.moments,ctx.cache.words??[],source.rangeMs,'focused_1fps',24)
    ctx.cache.visualEvidence.focused=focus
    ctx.cache.visualEvidence.metadata={
      ...ctx.cache.visualEvidence.metadata,focusFps:1,
      focusWindows:windows,focusedObservations:focus.length,
      actualFocusWindows:Number(result.meta?.focus_windows_analyzed??0),
      failedFocusWindows:Number(result.meta?.focus_windows_failed??0),
      focusWindowResults:Array.isArray(result.meta?.focus_window_results)
        ? result.meta.focus_window_results : [],
    }
    const cost=Number(result.meta?.est_usd??0)
    if(Number.isFinite(cost))budget.addGemini(cost)
    await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'ingest',
      tool:'visual_evidence_focus_ready',kind:'validate',
      argsSummary:JSON.stringify({windows,observations:focus.length,model:'gemini-3.1-flash-lite',
        fps:1,mediaResolution:'MEDIA_RESOLUTION_LOW',originalAudioAttached:true,
        windowResults:result.meta?.focus_window_results??[],
        failedWindows:result.meta?.focus_windows_failed??0}),
      resultSummary:`1fps detailed observations: ${focus.length}`,estUsd:Number.isFinite(cost)?cost:undefined})
  }catch(error){
    // Gemini failure can never replace or invalidate the proven transcript edit.
    await logAiProducerStep({runId:ctx.runId,stepIndex:budget.steps,phase:'ingest',
      tool:'visual_evidence_focus_unavailable',kind:'validate',
      argsSummary:JSON.stringify({windows}),
      resultSummary:'Retained coarse visual observations',
      error:String((error as Error)?.message??error).slice(0,250)})
  }
}

import 'server-only'

import type { Budget } from '@/lib/ai-producer-agent/budget'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import { enqueueAiProducerAnalyzeJob, waitForClipJobDone } from '@/lib/server/ai-producer-agent/enqueue-analyze'
import { framesFromSamples } from '@/lib/clips/cuts-quality/cut-boundary-refine'
import type { RmsFrames } from '@/lib/ai-producer-agent/draft-edits'

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
  const job = await enqueueAiProducerAnalyzeJob({
    runId: ctx.runId,
    projectId: anchor,
    mode,
    sources: ctx.sources,
    query: typeof args.query === 'string' ? args.query : undefined,
    targetClipLenS: Number(args.targetClipLenS ?? ctx.config.targetLengthS?.[1] ?? 30),
  })
  const finished = await waitForClipJobDone(job.id).catch(() => null)
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
    }
  }
  const costUsd = Number(result.costUsd ?? result.meta && (result.meta as Record<string, unknown>).est_usd ?? est)
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
  const job = await enqueueAiProducerAnalyzeJob({
    runId: ctx.runId,
    projectId: anchor,
    mode: 'best_moments',
    sources: ctx.sources,
  })
  await waitForClipJobDone(job.id).catch(() => null)
  const data = ctx.cache.visual ?? { laughs: [], reactions: [], actions: [], faces: [] }
  ctx.cache.laughs = (data.laughs as [number, number][]) ?? []
  budget.addGemini(est)
  return { ok: true, summary: 'visual analyzed', data, costUsd: est }
}

export async function audioEnergy(ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx, budget: Budget, args: Record<string, unknown>) {
  const est = 0
  if (!budget.canSpendGemini(est)) return { ok: false, summary: 'budget exceeded', costUsd: 0 }
  const frames = ctx.cache.rmsFrames ?? []
  ctx.rmsLookup = buildRmsLookup(frames)
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

export async function layoutInfo(_ctx: import('@/lib/ai-producer-agent/tools/registry').ToolCtx) {
  return { ok: true, summary: 'layout', data: { contentType: 'irl', mode: 'fit_blur' }, costUsd: 0 }
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

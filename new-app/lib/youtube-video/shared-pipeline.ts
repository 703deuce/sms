import 'server-only'

import { Budget } from '@/lib/ai-producer-agent/budget'
import { buildToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import { findMoments, refineVisualStoryEvidence } from '@/lib/ai-producer-agent/tools/analysis'
import { createEditorialHandoff, runEditorialRole, runStoryFlowReview, completeTranscriptWords, type EditorialSelection } from '@/lib/ai-producer-agent/specialists'
import { runStoryFinisher } from '@/lib/ai-producer-agent/story-finisher'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import { logAiProducerStep } from '@/lib/ai-producer-agent/log'
import type { YoutubeVideoCut, YoutubeVideoIngestedSource, YoutubeVideoOption } from '@/lib/youtube-video/types'
import { YOUTUBE_VIDEO_STORY_SYSTEM } from '@/lib/youtube-video/story-options'
import { youtubeRunEvent } from '@/lib/youtube-video/step-log'

const WINDOW_MS = 20 * 60_000
const MAX_STORY_INSERTS = 50

export type YoutubeSharedWindow = {
  sourceId: string
  startMs: number
  endMs: number
  cuts: YoutubeVideoCut[]
  rejectedCuts: Array<{ startMs: number; endMs: number; reason: string }>
  momentCount: number
  focusedCount: number
  story: string
}

export type YoutubeSharedCheckpoint = {
  version: 1
  sourceSignature: string
  completed: YoutubeSharedWindow[]
}

export type SharedArgs = {
  runId: string
  workspaceId: string
  createdById: string | null
  instruction: string | null
  sources: YoutubeVideoIngestedSource[]
  checkpoint: YoutubeSharedCheckpoint | null | undefined
  saveCheckpoint: (next: YoutubeSharedCheckpoint) => Promise<void>
}

/** No per-source runtime limit. The last remainder is folded into the last window. */
function windows(durationMs: number): Array<[number, number]> {
  if (!Number.isSafeInteger(durationMs) || durationMs < 1500) throw Error('youtube_source_duration_invalid')
  const ranges: Array<[number, number]> = []
  for (let start = 0; start < durationMs; start += WINDOW_MS) {
    const end = Math.min(durationMs, start + WINDOW_MS)
    if (end - start < 15_000 && ranges.length) {
      ranges[ranges.length - 1]![1] = end
    } else {
      ranges.push([start, end])
    }
  }
  return ranges
}

const signature = (sources: YoutubeVideoIngestedSource[]) =>
  sources.map(s => [s.sourceId, s.projectId, s.durationMs, s.words.length].join(':')).join('|')

/** Refuse to silently remove, clamp, reorder or overlap any approved segment. */
export function validateYoutubeSharedCuts(
  cuts: readonly YoutubeVideoCut[],
  sources: readonly YoutubeVideoIngestedSource[],
): void {
  if (!cuts.length) throw Error('youtube_no_approved_cuts')
  if (cuts.length > MAX_STORY_INSERTS + 1) throw Error('youtube_too_many_approved_cuts')
  const ids = new Map(sources.map((s, index) => [s.sourceId, { source: s, index }]))
  let lastSourceIndex = -1
  const lastEnd = new Map<string, number>()
  for (const [i, cut] of cuts.entries()) {
    const ref = ids.get(cut.sourceId)
    if (!ref) throw Error('youtube_unknown_source_at_' + i)
    if (!Number.isSafeInteger(cut.startMs) || !Number.isSafeInteger(cut.endMs) ||
        cut.startMs < 0 || cut.endMs - cut.startMs < 200 ||
        cut.endMs > ref.source.durationMs) throw Error('youtube_invalid_cut_at_' + i)
    if (ref.index < lastSourceIndex) throw Error('youtube_source_order_invalid_at_' + i)
    if (cut.startMs < (lastEnd.get(cut.sourceId) ?? 0))
      throw Error('youtube_overlapping_cuts_at_' + i)
    lastSourceIndex = ref.index
    lastEnd.set(cut.sourceId, cut.endMs)
  }
}

function momentsAsVisualCuts(
  moments: readonly Record<string, unknown>[],
  sourceId: string,
  range: [number, number],
): YoutubeVideoCut[] {
  const cuts: YoutubeVideoCut[] = []
  for (const moment of moments) {
    const startMs = Math.round(Number(moment.start_s) * 1000)
    const endMs = Math.round(Number(moment.end_s) * 1000)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) ||
        startMs < range[0] || endMs > range[1] || endMs - startMs < 200) continue
    cuts.push({ sourceId, startMs, endMs, label: 'Observed visual action' })
  }
  return cuts
}

function pickWindowCuts(
  spoken: readonly EditorialSelection[],
  visual: readonly {startMs:number;endMs:number;beat?:string}[],
  sourceId: string,
  range: [number, number],
): { accepted: YoutubeVideoCut[]; rejected: YoutubeSharedWindow['rejectedCuts'] } {
  const proposed = [
    ...spoken.map(c => ({ sourceId, startMs:c.startMs, endMs:c.endMs, label:c.beat })),
    ...visual.map(c => ({ sourceId, startMs:c.startMs, endMs:c.endMs, label:c.beat || 'Visual action' })),
  ].sort((a,b) => a.startMs-b.startMs || a.endMs-b.endMs)
  const accepted: YoutubeVideoCut[] = []
  const rejected: YoutubeSharedWindow['rejectedCuts'] = []
  for (const cut of proposed) {
    const reason = !Number.isSafeInteger(cut.startMs) || !Number.isSafeInteger(cut.endMs) ||
      cut.startMs < range[0] || cut.endMs > range[1] || cut.endMs-cut.startMs < 200
      ? 'out_of_window_or_short'
      : accepted.length && cut.startMs < accepted[accepted.length-1]!.endMs
      ? 'overlap_with_approved_passage' : null
    if (reason) rejected.push({ startMs:cut.startMs, endMs:cut.endMs, reason })
    else accepted.push(cut)
  }
  return { accepted, rejected }
}

/**
 * One durable window per request. The caller checkpoints and releases the
 * planning claim, so the next poll advances the NEXT window rather than
 * restarting a large source after a web process restart.
 */
export async function advanceYoutubeSharedStory(args: SharedArgs): Promise<
  | { done: false; checkpoint: YoutubeSharedCheckpoint }
  | { done: true; checkpoint: YoutubeSharedCheckpoint; options: YoutubeVideoOption[] }
> {
  const state: YoutubeSharedCheckpoint = args.checkpoint?.version === 1 &&
    args.checkpoint.sourceSignature === signature(args.sources)
    ? { ...args.checkpoint, completed: [...args.checkpoint.completed] }
    : { version: 1, sourceSignature: signature(args.sources), completed: [] }

  const existing = new Set(state.completed.map(w => [w.sourceId,w.startMs,w.endMs].join(':')))
  for (const source of args.sources) {
    for (const range of windows(source.durationMs)) {
      const key = [source.sourceId,range[0],range[1]].join(':')
      if (existing.has(key)) continue
      const [startMs,endMs] = range
      youtubeRunEvent(args.runId,'shared_analysis','window_start',{
        projectId:source.projectId, status:startMs+'-'+endMs,
      })
      const budget = new Budget({ wallClockMs:45*60_000, hardSteps:160,softSteps:120 })
      const ctx = await buildToolCtx({
        id:args.runId,workspaceId:args.workspaceId,createdById:args.createdById,
        genre:'agnostic',outputType:'story',platform:'youtube',
        instruction:args.instruction || YOUTUBE_VIDEO_STORY_SYSTEM,
        config:{
          storyMode:'single_source_v1',youtubeLongForm:true,roughCutIntent:'story',
          visualEvidenceMode:'visual_audio',targetLengthS:[0,Math.max(106,Math.ceil((endMs-startMs)/1000))],
          music:'none',memeSfx:'off',exportOnFinish:false,geminiUsdCap:1,
        },
        sourceSnapshot:[{sourceId:source.sourceId,kind:'upload',projectId:source.projectId,
          rangeMs:[startMs,endMs],durationMs:endMs-startMs}],
      }, budget)
      // Deepgram words keep absolute source timestamps, including for windows
      // beyond the first 20 minutes. Never write transcript text to the step log.
      ctx.cache.words = source.words.filter(w => w.e*1000 > startMs && w.s*1000 < endMs)
        .map(w => ({w:w.w,s:w.s,e:w.e}))
      const found = await findMoments(ctx,budget,{mode:'best_moments',youtubeLongForm:true,
        targetClipLenS:Math.max(106,Math.ceil((endMs-startMs)/1000))})
      if (!found.ok) throw Error('youtube_shared_analysis_failed')
      const momentCount = ctx.cache.moments?.length ?? 0
      youtubeRunEvent(args.runId,'shared_analysis','coarse_ready',{
        projectId:source.projectId,wordCount:momentCount,
      })
      await refineVisualStoryEvidence(ctx,budget,{youtubeLongForm:true})
      const focusedCount = ctx.cache.visualEvidence?.focused.length ?? 0
      youtubeRunEvent(args.runId,'shared_analysis','focus_ready',{
        projectId:source.projectId,wordCount:focusedCount,
      })
      let story = ''
      let selected: YoutubeVideoCut[] = []
      let rejected: YoutubeSharedWindow['rejectedCuts'] = []
      if (ctx.cache.words.length) {
        const out: OutputState = {
          index:0,outputType:'story',builder:null,replans:0,fixLoops:0,notes:[],
        }
        const handoff = await createEditorialHandoff(ctx,out,budget,
          args.instruction || YOUTUBE_VIDEO_STORY_SYSTEM)
        story = handoff.outline.logline
        youtubeRunEvent(args.runId,'shared_story','handoff',{
          projectId:source.projectId,wordCount:handoff.cutPlan.length,
        })
        const finished = await runStoryFinisher(ctx,budget,handoff.outline,handoff.cutPlan,
          'normal',undefined,{youtubeLongForm:true})
        const flow = await runStoryFlowReview(ctx,budget,handoff.outline,finished.selections)
        const qa = await runEditorialRole(ctx,out,budget,'qa',{
          storyOutline:handoff.outline,curatedSelections:flow.cutPlan,
          fullTranscriptWordIndexed:true,fullTranscript:completeTranscriptWords(ctx.cache.words,true),
          visualAudioEvidence:ctx.cache.visualEvidence,
          instruction:'Verify truthful opening, development, ending, source-grounded visual actions, and complete joins. No runtime restriction.',
        })
        if (qa.pass !== true) throw Error('youtube_shared_qa_failed')
        const picked = pickWindowCuts(flow.cutPlan,handoff.visualActions ?? [],source.sourceId,range)
        selected=picked.accepted
        rejected=picked.rejected
      } else {
        // Original audio may contain no intelligible speech. Preserve genuine
        // observed visual events instead of fabricating transcript dialogue.
        selected = momentsAsVisualCuts(ctx.cache.moments ?? [],source.sourceId,range)
        story = 'Observed silent visual moments'
      }
      if (!selected.length && !state.completed.length) throw Error('youtube_shared_no_valid_window_cuts')
      const window: YoutubeSharedWindow = {
        sourceId:source.sourceId,startMs,endMs,cuts:selected,rejectedCuts:rejected,
        momentCount,focusedCount,story,
      }
      state.completed.push(window)
      await args.saveCheckpoint(state)
      await logAiProducerStep({
        runId:args.runId,stepIndex:state.completed.length,phase:'planning',
        kind:'validate',tool:'youtube_window_checkpoint',
        argsSummary:JSON.stringify({range,selected:selected.map(c=>[c.startMs,c.endMs]),
          rejected:rejected.map(c=>[c.startMs,c.endMs])}),
        resultSummary:'Saved completed analysis window with '+selected.length+' approved cuts',
      })
      youtubeRunEvent(args.runId,'shared_analysis','window_checkpoint',{
        projectId:source.projectId,wordCount:selected.length,
      })
      return { done:false, checkpoint:state }
    }
  }

  const cuts=state.completed.flatMap(w=>w.cuts)
  validateYoutubeSharedCuts(cuts,args.sources)
  const premise=state.completed.find(w=>w.story.trim())?.story || 'Source-grounded long-form story'
  const option:YoutubeVideoOption={
    id:'yt_shared_story', title:premise.slice(0,100), premise,
    beats:cuts.map((c,i)=>({
      label:c.label || (i===0?'Opening':i===cuts.length-1?'Ending':'Story '+i),
      sourceId:c.sourceId,startMs:c.startMs,endMs:c.endMs,
    })),
    estDurationMs:cuts.reduce((sum,c)=>sum+c.endMs-c.startMs,0),
  }
  youtubeRunEvent(args.runId,'shared_story','merged_validated',{
    wordCount:cuts.length,sourceCount:args.sources.length,optionCount:1,
  })
  return { done:true, checkpoint:state, options:[option] }
}

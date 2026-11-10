import type { AiProducerSourceRef } from '@/lib/ai-producer-agent/types'
import { isClipAgentMode } from '@/lib/ai-producer-agent/clip-mode/modes'

/** Official competitor caps checked 9 Nov 2026 (America/New_York):
 * Opus Clip documents 10 hours (help.opus.pro/docs/article/video-length)
 * and 10 GB / 30 GB file size by plan. Vizard documents 600 minutes and 10 GB.
 * We match the 10-hour duration cap and the 30 GB Pro file cap.
 */
export const MAX_CLIP_AGENT_SOURCE_MS = 10 * 60 * 60 * 1000
/** Invisible analysis slice. Finder/watch jobs chunk at this size, then a
 * global selection and stitch pass runs across the whole authorized file. */
export const CLIP_ANALYSIS_CHUNK_MS = 20 * 60_000
export const MIN_CLIP_AGENT_SOURCE_MS = 15_000

/** Last 20 minutes of the already-authorized source, in absolute source time. */
export function roughCutSourceWindow(source: AiProducerSourceRef): AiProducerSourceRef {
  const [start, end] = source.rangeMs ?? [0, source.durationMs ?? 0]
  if (!(end > start) || end - start < 5 * 60_000) {
    throw new Error('rough_cut_requires_five_minutes_of_source')
  }
  const rangeMs: [number, number] = [Math.max(start, end - 20 * 60_000), end]
  return { ...source, rangeMs, durationMs: rangeMs[1] - rangeMs[0] }
}

/** Authorize one clip-agent run over a source up to 10 hours. Longer files
 * must be trimmed by the user. Analysis may still chunk internally. */
export function clipAgentSourceWindow(source: AiProducerSourceRef): AiProducerSourceRef {
  const [start,end]=source.rangeMs??[0,source.durationMs??0]
  if(!Number.isFinite(start)||!Number.isFinite(end)||end-start<MIN_CLIP_AGENT_SOURCE_MS)
    throw Error('clip_agent_source_too_short')
  if(end-start>MAX_CLIP_AGENT_SOURCE_MS)
    throw Error('clip_agent_source_exceeds_max_duration')
  return {...source,rangeMs:[start,end],durationMs:end-start}
}

/** Contiguous analysis slices covering [start, end], last fragment kept if ≥15s. */
export function clipAnalysisChunks(startMs:number,endMs:number,chunkMs=CLIP_ANALYSIS_CHUNK_MS):Array<[number,number]>{
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs-startMs<MIN_CLIP_AGENT_SOURCE_MS)
    throw Error('clip_agent_source_too_short')
  const chunks:Array<[number,number]>=[]
  for(let at=startMs;at<endMs;at+=chunkMs){
    const end=Math.min(endMs,at+chunkMs)
    if(end-at>=MIN_CLIP_AGENT_SOURCE_MS)chunks.push([at,end])
  }
  if(!chunks.length)throw Error('clip_agent_source_too_short')
  return chunks
}

/** Wall clock for one full-file clip run. Analysis plus sequential candidates
 * on a 65-minute interview previously took ~54 minutes as four windows. */
export function clipAgentWallClockMs(sourceMs:number):number{
  const span=Math.max(0,sourceMs)
  const extraChunks=Math.max(0,Math.ceil(span/CLIP_ANALYSIS_CHUNK_MS)-1)
  return Math.min(6*60*60_000,45*60_000+extraChunks*12*60_000)
}

export function analyzeWaitTimeoutMs(sourceMs:number):number{
  const extraChunks=Math.max(0,Math.ceil(Math.max(0,sourceMs)/CLIP_ANALYSIS_CHUNK_MS)-1)
  return Math.min(4*60*60_000,20*60_000+extraChunks*8*60_000)
}

export function clipAgentHardSteps(sourceMs:number):number{
  const extraChunks=Math.max(0,Math.ceil(Math.max(0,sourceMs)/CLIP_ANALYSIS_CHUNK_MS)-1)
  return Math.min(800,120+extraChunks*40)
}

/** Less commentary is common in games; never loosen existing long-form ingest. */
export function minimumAgentTranscriptWords(storyMode?:string):number{
  return isClipAgentMode(storyMode)?8:30
}

/** Per-candidate budget. Specialists plus assembly plus QA previously shared
 * the default 80-step Budget and exhausted it before QA could finish. */
export function clipCandidateHardSteps(sourceMs:number):number{
  const extraChunks=Math.max(0,Math.ceil(Math.max(0,sourceMs)/CLIP_ANALYSIS_CHUNK_MS)-1)
  return Math.min(400,200+extraChunks*20)
}
export function clipCandidateWallClockMs(sourceMs:number):number{
  const extraChunks=Math.max(0,Math.ceil(Math.max(0,sourceMs)/CLIP_ANALYSIS_CHUNK_MS)-1)
  return Math.min(45*60_000,12*60_000+extraChunks*3*60_000)
}
export function clipQaRetryHardSteps():number{return 80}
export function clipQaRetryWallClockMs():number{return 8*60_000}

/** Run-level limits grow with the number of candidates so logging/export
 * steps cannot cap a long yield after per-clip work already succeeded. */
export function clipAgentHardStepsForCandidates(sourceMs:number,candidateCount:number):number{
  return Math.min(2000,clipAgentHardSteps(sourceMs)+Math.max(0,candidateCount)*8)
}
export function clipAgentWallClockMsForCandidates(sourceMs:number,candidateCount:number):number{
  return Math.min(8*60*60_000,clipAgentWallClockMs(sourceMs)+Math.max(0,candidateCount)*2*60_000)
}

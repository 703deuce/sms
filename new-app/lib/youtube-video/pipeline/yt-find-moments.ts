import 'server-only'

import { YT_GAMING_WATCHER_PROMPT } from '@/lib/youtube-video/pipeline/yt-gaming-watcher-prompt'

import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import type { AiProducerSourceRef } from '@/lib/ai-producer-agent/types'
import { getPrisma } from '@/lib/server/db'
import { timestampedAsrForVisual } from '@/lib/ai-producer-agent/visual-evidence'
import type { YtObservation, YtTranscriptWord } from '@/lib/youtube-video/pipeline/yt-types'

type MediaRange = {
  runId: string
  projectId: string
  sourceId: string
  storageKey: string
  startMs: number
  endMs: number
  words: YtTranscriptWord[]
}

export function ytObservations(
  rows: unknown,
  range: [number,number],
  tier: YtObservation['tier'],
): YtObservation[] {
  if (!Array.isArray(rows)) return []
  const out: YtObservation[] = []
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string,unknown>
    const startMs = Math.round(Number(row.start_ms ?? Number(row.start_s) * 1000))
    const endMs = Math.round(Number(row.end_ms ?? Number(row.end_s) * 1000))
    if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) ||
        startMs < range[0] || endMs > range[1] || endMs <= startMs) continue
    const description = String(row.what_happened ?? row.visual_action ?? row.description ?? '').trim()
    if (!description) continue
    out.push({
      startMs,endMs,description:description.slice(0,420),
      whyInteresting:String(row.why_it_works ?? '').slice(0,300),
      category:String(row.category ?? row.content_type ?? 'moment').slice(0,80),
      score:Number.isFinite(Number(row.score)) ? Number(row.score) : 0,
      tier,
    })
    if (out.length >= 300) break
  }
  return out
}

/** YouTube copy of Producer findMoments. Enqueue only: never block a web GET
 * while the worker downloads and watches a 20-minute recording. */
export async function ytFindMoments(input: MediaRange): Promise<string> {
  const source = {
    sourceId: input.sourceId, kind: 'upload' as const,
    projectId: input.projectId, storageKey: input.storageKey,
    rangeMs: [input.startMs,input.endMs] as [number,number],
    durationMs:input.endMs-input.startMs,
  }
  return ytEnqueueAnalyze({
    runId:input.runId,projectId:input.projectId,source,
    mode:'best_moments',pass:'coarse',targetClipLenS:1200,
    visualEvidence:{
      enabled:true,model:'gemini-3.1-flash-lite',
      transcriptText:YT_GAMING_WATCHER_PROMPT+'\n\n'+timestampedAsrForVisual(input.words,source.rangeMs,120_000),
    },
  })
}

/** A queued worker job is durable. Subsequent polls read the SAME job ID. */
export async function ytReadMomentsJob(
  jobId: string, range:[number,number], tier:YtObservation['tier'],
):Promise<{status:'pending'}|{status:'ready';observations:YtObservation[]}> {
  const job=await getPrisma().clipJob.findUnique({
    where:{id:jobId},select:{status:true,payload:true,error:true},
  })
  if (!job) throw Error('youtube_analysis_job_missing')
  if (job.status === 'FAILED' || job.status === 'CANCELED') throw Error('youtube_analysis_job_failed')
  if (job.status !== 'DONE') return {status:'pending'}
  const payload=job.payload as {analyzeResult?:{moments?:unknown;meta?:Record<string,unknown>}} | null
  const result=payload?.analyzeResult
  if (!result) throw Error('youtube_analysis_result_missing')
  // The same worker contract as Producer visual_audio: low-res labeled
  // frames at 1 FPS, ORIGINAL audio, and Deepgram transcript text together.
  if (result.meta?.visual_audio_enabled !== true ||
      result.meta?.original_audio_attached !== true ||
      Number(result.meta?.fps) !== 1) throw Error('youtube_multimodal_evidence_missing')
  return {status:'ready',observations:ytObservations(result.moments,range,tier)}
}

/** Stable job ID protects against duplicate video analysis after HTTP crashes,
 * concurrent GET polls, or a checkpoint write interrupted after enqueue. */
export async function ytEnqueueAnalyze(input:{
  runId:string;projectId:string;source:AiProducerSourceRef;
  mode:'best_moments'|'visual_detail';pass:'coarse'|'focused';
  targetClipLenS:number;
  visualEvidence:{
    enabled:true;model:string;transcriptText?:string;
    focusWindows?:Array<{startMs:number;endMs:number;transcriptText:string}>;
  };
}):Promise<string>{
  const range=input.source.rangeMs
  if(!range)throw Error('yt_analysis_missing_range')
  const jobId=['ytan',input.runId,input.projectId,range[0],range[1],input.pass].join('_')
  await getPrisma().clipJob.upsert({
    where:{id:jobId},
    update:{},
    create:{
      id:jobId,projectId:input.projectId,type:'AI_PRODUCER_AGENT_ANALYZE',
      status:'QUEUED',
      payload:toPrismaJson({
        runId:input.runId,mode:input.mode,sources:[input.source],
        targetClipLenS:input.targetClipLenS,
        visualEvidence:input.visualEvidence,
      }),
    },
  })
  return jobId
}

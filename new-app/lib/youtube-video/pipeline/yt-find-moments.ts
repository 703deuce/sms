import 'server-only'

import { enqueueAiProducerAnalyzeJob } from '@/lib/server/ai-producer-agent/enqueue-analyze'
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
    if (out.length >= 80) break
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
  const job = await enqueueAiProducerAnalyzeJob({
    runId:input.runId, projectId:input.projectId, mode:'best_moments',
    sources:[source], targetClipLenS:60,
    visualEvidence:{
      enabled:true,model:'gemini-3.1-flash-lite',
      transcriptText:timestampedAsrForVisual(input.words,source.rangeMs,60_000),
    },
  })
  return job.id
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

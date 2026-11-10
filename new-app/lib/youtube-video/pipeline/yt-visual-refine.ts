import 'server-only'

import { enqueueAiProducerAnalyzeJob } from '@/lib/server/ai-producer-agent/enqueue-analyze'
import { chooseVisualFocusWindows, timestampedAsrForVisual } from '@/lib/ai-producer-agent/visual-evidence'
import type { YtObservation, YtTranscriptWord } from '@/lib/youtube-video/pipeline/yt-types'

/** YouTube-specific copy of the Producer focused pass. The shared Python
 * watcher already implements 1 FPS, MEDIA_RESOLUTION_LOW and force_audio. */
export async function ytRefineVisualStoryEvidence(input: {
  runId:string;projectId:string;sourceId:string;storageKey:string;
  startMs:number;endMs:number;words:YtTranscriptWord[];coarse:YtObservation[];
}): Promise<string | null> {
  const range:[number,number]=[input.startMs,input.endMs]
  const candidates=input.coarse.map(m=>({
    start_ms:m.startMs,end_ms:m.endMs,score:m.score,
  }))
  const windows=chooseVisualFocusWindows(candidates,range,3)
  if (!windows.length) return null
  const job=await enqueueAiProducerAnalyzeJob({
    runId:input.runId,projectId:input.projectId,mode:'visual_detail',
    sources:[{
      sourceId:input.sourceId,kind:'upload',projectId:input.projectId,
      storageKey:input.storageKey,rangeMs:range,
      durationMs:input.endMs-input.startMs,
    }],
    targetClipLenS:60,
    visualEvidence:{
      enabled:true,model:'gemini-3.1-flash-lite',
      focusWindows:windows.map(([startMs,endMs])=>({
        startMs,endMs,
        transcriptText:timestampedAsrForVisual(input.words,[startMs,endMs],12_000),
      })),
    },
  })
  return job.id
}

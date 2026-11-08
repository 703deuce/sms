import type { AiProducerSourceRef } from '@/lib/ai-producer-agent/types'

/** Last 20 minutes of the already-authorized source, in absolute source time. */
export function roughCutSourceWindow(source: AiProducerSourceRef): AiProducerSourceRef {
  const [start, end] = source.rangeMs ?? [0, source.durationMs ?? 0]
  if (!(end > start) || end - start < 5 * 60_000) {
    throw new Error('rough_cut_requires_five_minutes_of_source')
  }
  const rangeMs: [number, number] = [Math.max(start, end - 20 * 60_000), end]
  return { ...source, rangeMs, durationMs: rangeMs[1] - rangeMs[0] }
}

/** Short-form specialist agents must not silently inspect only the end of a
 * multi-hour stream. A source-local window is required until the entire VOD
 * can be batched into independent analysis jobs. Small clips are supported. */
export function clipAgentSourceWindow(source: AiProducerSourceRef): AiProducerSourceRef {
  const [start,end]=source.rangeMs??[0,source.durationMs??0]
  if(!Number.isFinite(start)||!Number.isFinite(end)||end-start<15_000)
    throw Error('clip_agent_source_too_short')
  if(end-start>20*60_000)
    throw Error('clip_agent_requires_bounded_source_window')
  return {...source,rangeMs:[start,end],durationMs:end-start}
}

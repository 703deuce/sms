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

/** Copied from the editor/clipper analysis window (rough-cut-window.ts). Do not change the original. */
export const CLIP_ANALYSIS_CHUNK_MS = 20 * 60_000
export const MIN_CLIP_AGENT_SOURCE_MS = 15_000

/** Contiguous analysis slices covering [start, end], last fragment kept if ≥15s. */
export function clipAnalysisChunks(
  startMs: number,
  endMs: number,
  chunkMs = CLIP_ANALYSIS_CHUNK_MS,
): Array<[number, number]> {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs - startMs < MIN_CLIP_AGENT_SOURCE_MS) {
    throw new Error('clip_agent_source_too_short')
  }
  const chunks: Array<[number, number]> = []
  for (let at = startMs; at < endMs; at += chunkMs) {
    const end = Math.min(endMs, at + chunkMs)
    if (end - at >= MIN_CLIP_AGENT_SOURCE_MS) chunks.push([at, end])
  }
  if (!chunks.length) throw new Error('clip_agent_source_too_short')
  return chunks
}

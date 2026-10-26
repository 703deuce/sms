/** ETA for non-streamer clip projects (worker rarely sends etaSeconds). */
export function computeNonStreamerClipEtaSec(input: {
  progress: number
  createdAtMs: number
  nowMs?: number
}): number {
  const progress = input.progress
  if (progress <= 0) return 0
  const now = input.nowMs ?? Date.now()
  const elapsedSec = Math.max(1, (now - input.createdAtMs) / 1000)
  const remaining = elapsedSec * (100 - progress) / progress
  return Math.max(0, Math.round(remaining))
}

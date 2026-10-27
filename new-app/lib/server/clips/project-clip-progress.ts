import type { ClipProjectStatus } from '@prisma/client'

/** Poll payload: avoid treating all DB clip rows as "ready" mid REFRAMING/RENDERING. */
export function resolveClipsReadyForStatus(input: {
  status: ClipProjectStatus
  clipCount: number
  clipsWithPreview: number
  streamerProgress: Record<string, unknown>
}): { clipsReady?: number; clipsTotal?: number } {
  const sp = input.streamerProgress
  const clipsTotal = typeof sp.clipsTotal === 'number' ? sp.clipsTotal : undefined
  if (typeof sp.clipsReady === 'number') {
    return { clipsReady: sp.clipsReady, clipsTotal }
  }
  if (input.clipCount <= 0) {
    return { clipsReady: undefined, clipsTotal }
  }
  const midPipeline = input.status === 'REFRAMING' || input.status === 'RENDERING'
  if (midPipeline) {
    return { clipsReady: input.clipsWithPreview, clipsTotal }
  }
  return { clipsReady: input.clipCount, clipsTotal }
}

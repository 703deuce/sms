import type { ClipProjectStatus } from '@prisma/client'

export type StreamPipelinePhase =
  | 'waiting_replay'
  | 'live_clipping'
  | 'pulling_audio'
  | 'finding_moments'
  | 'clipping'
  | 'ready'
  | 'failed'

const LABELS: Record<StreamPipelinePhase, string> = {
  waiting_replay: 'Waiting for replay',
  live_clipping: 'Live clipping',
  pulling_audio: 'Pulling audio',
  finding_moments: 'Finding moments',
  clipping: 'Clipping',
  ready: 'Ready',
  failed: 'Failed',
}

const WAITING_REPLAY_BY_PLATFORM: Partial<Record<string, string>> = {
  kick: 'Waiting for Kick to publish your replay',
}

export function streamPipelineLabel(
  phase: StreamPipelinePhase,
  opts?: { platform?: string | null },
): string {
  if (phase === 'waiting_replay' && opts?.platform === 'kick') {
    return WAITING_REPLAY_BY_PLATFORM.kick ?? LABELS.waiting_replay
  }
  return LABELS[phase]
}

export function resolveStreamPipelinePhase(input: {
  status: ClipProjectStatus
  stage: string | null
  triggeredBy: string
  waitingForWorker?: boolean
  pendingAutopull?: boolean
  liveRolling?: boolean
}): StreamPipelinePhase {
  if (input.status === 'FAILED' || input.status === 'CANCELED') return 'failed'
  if (input.status === 'READY') return 'ready'
  if (input.status === 'RENDERING') return 'clipping'
  if (input.liveRolling) return 'live_clipping'

  const stage = (input.stage ?? '').toLowerCase()
  if (input.status === 'FINDING_CLIPS' || stage.includes('find') || stage.includes('picker')) {
    return 'finding_moments'
  }
  if (
    input.status === 'TRANSCRIBING' ||
    input.status === 'PREPARING' ||
    stage.includes('transcri') ||
    stage.includes('download') ||
    stage.includes('prepar')
  ) {
    return 'pulling_audio'
  }

  if (
    input.pendingAutopull ||
    (input.triggeredBy === 'auto' && input.status === 'QUEUED' && input.waitingForWorker)
  ) {
    return 'waiting_replay'
  }

  if (input.status === 'QUEUED') return 'waiting_replay'
  return 'pulling_audio'
}

import type { ClipProjectStatus } from '@prisma/client'

export type StreamPipelinePhase =
  | 'waiting_replay'
  | 'pulling_audio'
  | 'finding_moments'
  | 'clipping'
  | 'ready'
  | 'failed'

const LABELS: Record<StreamPipelinePhase, string> = {
  waiting_replay: 'Waiting for replay',
  pulling_audio: 'Pulling audio',
  finding_moments: 'Finding moments',
  clipping: 'Clipping',
  ready: 'Ready',
  failed: 'Failed',
}

export function streamPipelineLabel(phase: StreamPipelinePhase): string {
  return LABELS[phase]
}

export function resolveStreamPipelinePhase(input: {
  status: ClipProjectStatus
  stage: string | null
  triggeredBy: string
  waitingForWorker?: boolean
  pendingAutopull?: boolean
}): StreamPipelinePhase {
  if (input.status === 'FAILED' || input.status === 'CANCELED') return 'failed'
  if (input.status === 'READY') return 'ready'
  if (input.status === 'RENDERING') return 'clipping'

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

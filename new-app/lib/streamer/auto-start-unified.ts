import {
  storyTargetFromAgentSeconds,
  type UnifiedClipRunSource,
} from '@/lib/ai-producer-agent/clip-mode/unified-run-input'
import {streamerAgentSettings} from '@/lib/streamer/agent-batch-contract'

/** Ingest jobs that finish with transcript + video already on the project. */
export const AUTO_START_INGEST_JOB_TYPES = [
  'PROCESS_PROJECT',
  'STREAM_ANALYZE',
  'STREAM_RENDER',
] as const

/** Statuses that mean ingest is done and a unified run may start.
 * FINDING_CLIPS is the in-progress state while the agent runs.
 * READY is kept so older ingest jobs that still flip READY can hook. */
export const AUTO_START_INGEST_STATUSES = ['FINDING_CLIPS', 'READY'] as const

export function shouldHookAutoStartUnified(
  jobType: string,
  projectStatus?: string,
  jobStatus?: string,
): boolean {
  if (!projectStatus || jobStatus !== 'DONE') return false
  return (AUTO_START_INGEST_STATUSES as readonly string[]).includes(projectStatus)
    && (AUTO_START_INGEST_JOB_TYPES as readonly string[]).includes(jobType)
}

export type AutoStartProjectSnap = {
  id: string
  status: string
  deletedAt?: Date | string | null
  uploadId?: string | null
  settings: unknown
  rangeStartMs: number
  rangeEndMs: number
  title?: string | null
  transcriptWords?: unknown
  transcriptKey?: string | null
  streamVod?: {
    platform: string
    attestedAt?: Date | string | null
    channel?: {status: string; deletedAt?: Date | string | null} | null
  } | null
}

export type AutoStartUnifiedPlan = {
  source: UnifiedClipRunSource
  targetLengthS: [number, number]
}

function hasTranscript(project: AutoStartProjectSnap): boolean {
  if (project.transcriptKey) return true
  return Array.isArray(project.transcriptWords) && project.transcriptWords.length > 0
}

function isTwitchKickStream(project: AutoStartProjectSnap): boolean {
  const platform = project.streamVod?.platform
  return platform === 'twitch' || platform === 'kick'
}

function streamPermissionOk(project: AutoStartProjectSnap): boolean {
  const vod = project.streamVod
  if (!vod) return false
  if (vod.attestedAt) return true
  const channel = vod.channel
  return Boolean(channel && channel.status === 'CONNECTED' && !channel.deletedAt)
}

/**
 * Decide whether a finished ingest should start one clip_unified_v1 job.
 * Twitch/Kick stream imports start unified on this project's range (the full
 * imported range, or an already-windowed project). Uploads still require
 * autoAgentClipMode. Never plans a per-window Story/continuous batch.
 */
export function planAutoStartUnifiedClip(
  project: AutoStartProjectSnap | null | undefined,
): AutoStartUnifiedPlan | null {
  if (!project || project.deletedAt) return null
  if (!(AUTO_START_INGEST_STATUSES as readonly string[]).includes(project.status)) return null
  const settings = streamerAgentSettings(project.settings)
  if (settings.agentClipBatch || settings.unifiedClipRunId) return null
  const rangeMs: [number, number] = [project.rangeStartMs, project.rangeEndMs]
  if (!(rangeMs[1] - rangeMs[0] >= 15_000)) return null
  const targetLengthS = storyTargetFromAgentSeconds(Number(settings.autoAgentClipSeconds))
  const title = project.title ?? undefined

  if (isTwitchKickStream(project)) {
    if (!project.uploadId) return null
    if (!hasTranscript(project)) return null
    if (!streamPermissionOk(project)) return null
    return {
      source: {
        sourceId: 'stream_recording',
        kind: 'stream',
        projectId: project.id,
        rangeMs,
        durationMs: rangeMs[1] - rangeMs[0],
        title,
      },
      targetLengthS,
    }
  }

  const mode = settings.autoAgentClipMode
  if (mode !== 'clip_moment_v1' && mode !== 'clip_story_v1' && mode !== 'clip_unified_v1') {
    return null
  }
  if (!project.uploadId) return null
  return {
    source: {
      sourceId: 'uploaded_recording',
      kind: 'upload',
      projectId: project.id,
      rangeMs,
      durationMs: rangeMs[1] - rangeMs[0],
      title,
    },
    targetLengthS,
  }
}

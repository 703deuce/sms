import { StudioError } from './errors'
import { refreshStudioJob, type StudioService } from './jobs'

export type SendToTimelineResult = { ok: true; projectId: string; clipId: string }

export type TimelineWriter = (input: {
  workspaceId: string
  projectId: string
  targetClipId?: string | null
  jobId: string
  title: string
  storageKey: string
  contentType: string
  durationMs: number
  width: number | null
  height: number | null
  kind: 'video' | 'image'
  storageDriver: string | null
}) => Promise<SendToTimelineResult>

export async function sendStudioJobToTimeline(
  svc: StudioService,
  input: {
    workspaceId: string
    jobId: string
    projectId: string
    clipId?: string
    write?: TimelineWriter
  },
): Promise<SendToTimelineResult> {
  const projectId = (input.projectId || '').trim()
  if (!projectId) throw new StudioError('INVALID_PARAMS', 'projectId is required')

  const exists = await svc.store.projectExists(input.workspaceId, projectId)
  if (!exists) throw new StudioError('PROJECT_NOT_FOUND', 'Project not found')

  if (input.clipId) {
    const ok = await svc.store.clipInProject(input.workspaceId, projectId, input.clipId)
    if (!ok) throw new StudioError('INVALID_PARAMS', 'clipId was not found in this project')
  }

  const job = await svc.store.getJob(input.workspaceId, input.jobId)
  if (!job) throw new StudioError('JOB_NOT_FOUND', 'Job not found')
  const fresh = await refreshStudioJob(svc, job)
  if (fresh.status !== 'done' || !fresh.outputStorageKey || !fresh.outputKind || !fresh.outputContentType) {
    throw new StudioError('JOB_NOT_READY', 'Job output is not ready')
  }

  const title = fresh.prompt.slice(0, 80) || 'Studio output'
  const durationMs = Math.round((fresh.outputDurationSec ?? fresh.durationSec ?? (fresh.outputKind === 'image' ? 3 : 4)) * 1000)
  if (!input.write) throw new StudioError('JOB_NOT_READY', 'Job output is not ready')
  return input.write({
    workspaceId: input.workspaceId,
    projectId,
    targetClipId: input.clipId ?? null,
    jobId: fresh.id,
    title,
    storageKey: fresh.outputStorageKey,
    contentType: fresh.outputContentType,
    durationMs,
    width: fresh.outputWidth,
    height: fresh.outputHeight,
    kind: fresh.outputKind,
    storageDriver: fresh.outputStorageDriver,
  })
}

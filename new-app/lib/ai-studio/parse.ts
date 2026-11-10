import {
  STUDIO_API_VERSION,
  STUDIO_ASPECTS,
  STUDIO_JOB_STATUSES,
  STUDIO_MEDIA_KINDS,
  STUDIO_MODES,
  type StudioAspect,
  type StudioJob,
  type StudioJobOutput,
  type StudioJobStatus,
  type StudioMediaKind,
  type StudioMode,
  type StudioModel,
  type StudioModelRegistry,
  type ListStudioJobsResponse,
  type SendToTimelineResponse,
} from './contract'
import { StudioClientError, mapStudioHttpError } from './errors'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null
  return typeof v === 'string' ? v : null
}

function asNullableNumber(v: unknown): number | null {
  if (v == null) return null
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function isStudioMode(v: unknown): v is StudioMode {
  return typeof v === 'string' && (STUDIO_MODES as readonly string[]).includes(v)
}

export function isStudioAspect(v: unknown): v is StudioAspect {
  return typeof v === 'string' && (STUDIO_ASPECTS as readonly string[]).includes(v)
}

export function isStudioJobStatus(v: unknown): v is StudioJobStatus {
  return typeof v === 'string' && (STUDIO_JOB_STATUSES as readonly string[]).includes(v)
}

export function isStudioMediaKind(v: unknown): v is StudioMediaKind {
  return typeof v === 'string' && (STUDIO_MEDIA_KINDS as readonly string[]).includes(v)
}

function parseFail(message: string): never {
  throw new StudioClientError(
    mapStudioHttpError({ status: 0, body: { error: message, code: 'INVALID_PARAMS' } }),
  )
}

export function parseStudioModel(raw: unknown): StudioModel {
  if (!isRecord(raw)) parseFail('Invalid model entry')
  const id = asString(raw.id)
  const label = asString(raw.label)
  const kind = raw.kind
  const creditEstimate = asNumber(raw.creditEstimate)
  if (!id || !label || !isStudioMediaKind(kind) || creditEstimate == null) parseFail('Invalid model entry')
  const modes = Array.isArray(raw.modes) ? raw.modes.filter(isStudioMode) : []
  const aspects = Array.isArray(raw.aspects) ? raw.aspects.filter(isStudioAspect) : []
  const durationsSec = Array.isArray(raw.durationsSec)
    ? raw.durationsSec.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
    : []
  const resolutions = Array.isArray(raw.resolutions)
    ? raw.resolutions.filter((n): n is string => typeof n === 'string' && n.length > 0)
    : []
  return {
    id,
    label,
    kind,
    modes,
    supportsStartEndFrame: raw.supportsStartEndFrame === true,
    supportsReferenceImage: raw.supportsReferenceImage === true,
    aspects,
    durationsSec,
    resolutions,
    creditEstimate,
  }
}

export function parseStudioRegistry(raw: unknown): StudioModelRegistry {
  const doc = isRecord(raw) && isRecord(raw.data) ? raw.data : raw
  if (!isRecord(doc)) parseFail('Invalid model registry')
  if (doc.version !== STUDIO_API_VERSION) parseFail('Unsupported studio registry version')
  if (!Array.isArray(doc.models)) parseFail('Invalid model registry')
  return { version: STUDIO_API_VERSION, models: doc.models.map(parseStudioModel) }
}

function parseOutput(raw: unknown): StudioJobOutput | null {
  if (raw == null) return null
  if (!isRecord(raw)) return null
  const kind = raw.kind
  const contentType = asString(raw.contentType)
  const previewUrl = asString(raw.previewUrl)
  const downloadUrl = asString(raw.downloadUrl)
  if (!isStudioMediaKind(kind) || !contentType || !previewUrl || !downloadUrl) return null
  return {
    kind,
    contentType,
    width: asNullableNumber(raw.width),
    height: asNullableNumber(raw.height),
    durationSec: asNullableNumber(raw.durationSec),
    previewUrl,
    downloadUrl,
  }
}

export function parseStudioJob(raw: unknown): StudioJob {
  const job = isRecord(raw) && isRecord(raw.job) ? raw.job : raw
  if (!isRecord(job)) parseFail('Invalid studio job')
  const id = asString(job.id)
  const status = job.status
  const modelId = asString(job.modelId)
  const mode = job.mode
  const prompt = asString(job.prompt)
  const creditEstimate = asNumber(job.creditEstimate)
  const createdAt = asString(job.createdAt)
  const updatedAt = asString(job.updatedAt)
  if (
    !id ||
    !isStudioJobStatus(status) ||
    !modelId ||
    !isStudioMode(mode) ||
    prompt == null ||
    creditEstimate == null ||
    !createdAt ||
    !updatedAt
  ) {
    parseFail('Invalid studio job')
  }
  const err = job.error
  const error =
    err == null
      ? null
      : isRecord(err) && typeof err.code === 'string' && typeof err.message === 'string'
        ? { code: err.code, message: err.message }
        : null
  return {
    id,
    status,
    modelId,
    mode,
    prompt,
    aspect: isStudioAspect(job.aspect) ? job.aspect : null,
    durationSec: asNullableNumber(job.durationSec),
    resolution: asNullableString(job.resolution),
    creditEstimate,
    projectId: asNullableString(job.projectId),
    output: parseOutput(job.output),
    error,
    createdAt,
    updatedAt,
    startedAt: asNullableString(job.startedAt),
    completedAt: asNullableString(job.completedAt),
  }
}

export function parseStudioJobEnvelope(raw: unknown): StudioJob {
  return parseStudioJob(raw)
}

export function parseJobList(raw: unknown): ListStudioJobsResponse {
  if (!isRecord(raw) || !Array.isArray(raw.jobs)) parseFail('Invalid job list')
  const next = raw.nextCursor
  return {
    jobs: raw.jobs.map(parseStudioJob),
    nextCursor: next == null ? null : asString(next),
  }
}

export function parseAssetId(raw: unknown): { id: string } {
  const doc = isRecord(raw) && isRecord(raw.data) ? raw.data : raw
  if (!isRecord(doc)) parseFail('Invalid asset response')
  const id = asString(doc.id)
  if (!id) parseFail('Invalid asset response')
  return { id }
}

export function parseSendToTimeline(raw: unknown): SendToTimelineResponse {
  if (!isRecord(raw) || raw.ok !== true) parseFail('Invalid send-to-timeline response')
  const projectId = asString(raw.projectId)
  const clipId = asString(raw.clipId)
  if (!projectId || !clipId) parseFail('Invalid send-to-timeline response')
  return { ok: true, projectId, clipId }
}

export function parseEditorProjects(raw: unknown): { id: string; title: string }[] {
  const list = isRecord(raw) && isRecord(raw.data) && Array.isArray(raw.data.projects)
    ? raw.data.projects
    : isRecord(raw) && Array.isArray(raw.projects)
      ? raw.projects
      : null
  if (!list) return []
  const out: { id: string; title: string }[] = []
  for (const row of list) {
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (!id) continue
    out.push({ id, title: asString(row.title) || 'Untitled project' })
  }
  return out
}

import type {
  YoutubeVideoBeat,
  YoutubeVideoChapter,
  YoutubeVideoOption,
  YoutubeVideoPlan,
  YoutubeVideoResult,
  YoutubeVideoRunView,
  YoutubeVideoStage,
  YoutubeVideoStatus,
} from '../youtube-video/types'
import { YOUTUBE_VIDEO_STAGES, YOUTUBE_VIDEO_STATUSES } from '../youtube-video/types'
import { fallbackEditorUrl, sanitizeYoutubeVideoMessage } from './format'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return undefined
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

function unwrap(input: unknown): Record<string, unknown> {
  const root = isRecord(input) ? input : {}
  const data = isRecord(root.data) ? root.data : root
  const run = isRecord(data.run) ? { ...data, ...data.run } : data
  return run
}

function parseStatus(raw: unknown): YoutubeVideoStatus {
  const s = str(raw)
  if (s === 'done') return 'ready'
  if (s && (YOUTUBE_VIDEO_STATUSES as readonly string[]).includes(s)) return s as YoutubeVideoStatus
  return 'queued'
}

function parseStage(raw: unknown): YoutubeVideoStage | null {
  const s = str(raw)
  if (s && (YOUTUBE_VIDEO_STAGES as readonly string[]).includes(s)) return s as YoutubeVideoStage
  return s ? (s as YoutubeVideoStage) : null
}

function parseBeat(raw: unknown): YoutubeVideoBeat | null {
  if (!isRecord(raw)) return null
  const label = str(raw.label) ?? str(raw.title) ?? ''
  let startMs = num(raw.startMs)
  let endMs = num(raw.endMs)
  let sourceId = str(raw.sourceId)
  if ((startMs == null || endMs == null) && Array.isArray(raw.ranges) && isRecord(raw.ranges[0])) {
    const first = raw.ranges[0]
    startMs = startMs ?? num(first.startMs)
    endMs = endMs ?? num(first.endMs)
    sourceId = sourceId ?? str(first.sourceId)
  }
  const beat: YoutubeVideoBeat = { label }
  if (startMs != null) beat.startMs = startMs
  if (endMs != null) beat.endMs = endMs
  if (sourceId) beat.sourceId = sourceId
  const evidence = str(raw.evidence)
  if (evidence) beat.evidence = evidence
  else if (raw.evidence != null) beat.evidence = typeof raw.evidence === 'string' ? raw.evidence : JSON.stringify(raw.evidence)
  return beat
}

function parseChapter(raw: unknown): YoutubeVideoChapter | null {
  if (!isRecord(raw)) return null
  const title = str(raw.title)
  const startMs = num(raw.startMs)
  if (!title || startMs == null) return null
  return { title, startMs }
}

function parseOption(raw: unknown): YoutubeVideoOption | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id) ?? str(raw.optionId)
  if (!id) return null
  const title = str(raw.title) ?? id
  const premise = str(raw.premise) ?? ''
  const beats = Array.isArray(raw.beats)
    ? raw.beats.map(parseBeat).filter((b): b is YoutubeVideoBeat => !!b)
    : []
  const option: YoutubeVideoOption = { id, title, premise, beats }
  const estDurationMs = num(raw.estDurationMs)
  if (estDurationMs != null) option.estDurationMs = estDurationMs
  return option
}

function parsePlan(raw: unknown): YoutubeVideoPlan | null {
  if (!isRecord(raw)) return null
  const premise = str(raw.premise) ?? str(raw.summary) ?? str(raw.description) ?? str(raw.title) ?? ''
  const beats = Array.isArray(raw.beats)
    ? raw.beats.map(parseBeat).filter((b): b is YoutubeVideoBeat => !!b)
    : []
  return { premise, beats }
}

function parseResult(raw: Record<string, unknown>, fallback: Record<string, unknown>): YoutubeVideoResult | null {
  const resultRaw = isRecord(raw.result) ? { ...fallback, ...raw.result } : fallback
  const clipId = str(resultRaw.clipId)
  const projectId = str(resultRaw.projectId)
  if (!clipId || !projectId) return null
  const planSource = resultRaw.plan ?? resultRaw.planCard
  const plan = parsePlan(planSource) ?? { premise: str(resultRaw.premise) ?? '', beats: [] }
  const chapterSource = isRecord(planSource) ? planSource : resultRaw
  const chapters = Array.isArray(resultRaw.chapters)
    ? resultRaw.chapters.map(parseChapter).filter((c): c is YoutubeVideoChapter => !!c)
    : Array.isArray(chapterSource.chapters)
      ? chapterSource.chapters.map(parseChapter).filter((c): c is YoutubeVideoChapter => !!c)
      : []
  const durationMs = num(resultRaw.durationMs) ?? (num(resultRaw.durationSeconds) != null ? Math.round(Number(resultRaw.durationSeconds) * 1000) : 0)
  const durationSeconds = num(resultRaw.durationSeconds) ?? durationMs / 1000
  return {
    clipId,
    projectId,
    renderId: str(resultRaw.renderId) ?? null,
    editorUrl: str(resultRaw.editorUrl) ?? fallbackEditorUrl(projectId, clipId),
    durationMs,
    durationSeconds,
    playbackUrl: str(resultRaw.playbackUrl) ?? null,
    thumbnailUrl: str(resultRaw.thumbnailUrl) ?? str(resultRaw.posterUrl) ?? null,
    downloadUrl: str(resultRaw.downloadUrl) ?? null,
    plan,
    chapters,
    chapterText: str(resultRaw.chapterText) ?? str(chapterSource.chapterText) ?? '',
    ...(isRecord(resultRaw.analysisAudit)
      ? { analysisAudit: resultRaw.analysisAudit as YoutubeVideoResult['analysisAudit'] }
      : {}),
  }
}

export function parseYoutubeVideoRun(input: unknown): YoutubeVideoRunView {
  const raw = unwrap(input)
  const runId = str(raw.runId) ?? str(raw.id)
  if (!runId) throw new Error('YouTube Video run is missing an id')
  const optionsFromRun = Array.isArray(raw.options)
    ? raw.options.map(parseOption).filter((o): o is YoutubeVideoOption => !!o)
    : []
  const planSource = raw.plan ?? raw.planCard
  const plan = parsePlan(planSource)
  const planOptions =
    isRecord(planSource) && Array.isArray(planSource.options)
      ? planSource.options.map(parseOption).filter((o): o is YoutubeVideoOption => !!o)
      : []
  const options = optionsFromRun.length ? optionsFromRun : planOptions
  const result = parseResult(raw, raw)
  return {
    runId,
    status: parseStatus(raw.status),
    stage: parseStage(raw.stage),
    progressPercent: num(raw.progressPercent) ?? num(raw.progress) ?? null,
    failureCode: str(raw.failureCode) ?? (isRecord(raw.error) ? str(raw.error.code) ?? null : null),
    failureMessage: sanitizeYoutubeVideoMessage(
      str(raw.failureMessage) ?? (isRecord(raw.error) ? str(raw.error.message) : undefined) ?? '',
    ) || null,
    creditsEstimated: num(raw.creditsEstimated) ?? num(raw.creditEstimate) ?? null,
    options: options.length ? options : null,
    result,
    analysisAudit:isRecord(raw.analysisAudit)
      ?raw.analysisAudit as YoutubeVideoResult['analysisAudit']
      :result?.analysisAudit??null,
  }
}

export class YoutubeVideoHttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(sanitizeYoutubeVideoMessage(message))
    this.name = 'YoutubeVideoHttpError'
    this.status = status
    this.code = code
  }
}

export function parseHttpErrorPayload(status: number, body: unknown): YoutubeVideoHttpError {
  const rec = isRecord(body) ? body : {}
  const data = isRecord(rec.data) ? rec.data : rec
  const err = isRecord(rec.error) ? rec.error : data
  const code =
    str(err.code) ??
    str(data.failureCode) ??
    (status === 409 ? 'option_already_chosen' : 'ERROR')
  const message =
    str(err.message) ??
    str(rec.error) ??
    str(data.error) ??
    str(data.failureMessage) ??
    str(rec.message) ??
    (status === 409
      ? code === 'choice_not_available'
        ? 'Story options are not ready yet.'
        : 'A different option was already chosen.'
      : `Request failed (${status})`)
  return new YoutubeVideoHttpError(status, code, message)
}

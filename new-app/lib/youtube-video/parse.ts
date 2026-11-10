import {
  YOUTUBE_VIDEO_STATUSES,
  type YoutubeVideoBeat,
  type YoutubeVideoBeatRange,
  type YoutubeVideoChapter,
  type YoutubeVideoError,
  type YoutubeVideoOption,
  type YoutubeVideoPlan,
  type YoutubeVideoRun,
  type YoutubeVideoStatus,
} from './contract'
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

function parseRange(raw: unknown): YoutubeVideoBeatRange | null {
  if (!isRecord(raw)) return null
  const startMs = num(raw.startMs)
  const endMs = num(raw.endMs)
  if (startMs == null || endMs == null) return null
  const sourceId = str(raw.sourceId)
  return sourceId ? { sourceId, startMs, endMs } : { startMs, endMs }
}

function parseBeat(raw: unknown): YoutubeVideoBeat | null {
  if (!isRecord(raw)) return null
  const label = str(raw.title) ?? str(raw.label) ?? ''
  let ranges: YoutubeVideoBeatRange[] = []
  if (Array.isArray(raw.ranges)) {
    ranges = raw.ranges.map(parseRange).filter((r): r is YoutubeVideoBeatRange => !!r)
  } else {
    const one = parseRange(raw)
    if (one) ranges = [one]
  }
  const beat: YoutubeVideoBeat = { label, ranges }
  if ('evidence' in raw) beat.evidence = raw.evidence
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
  const optionId = str(raw.optionId) ?? str(raw.id)
  if (!optionId) return null
  const title = str(raw.title)
  const beats = Array.isArray(raw.beats)
    ? raw.beats.map(parseBeat).filter((b): b is YoutubeVideoBeat => !!b)
    : []
  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters.map(parseChapter).filter((c): c is YoutubeVideoChapter => !!c)
    : []
  const chapterText = str(raw.chapterText)
  const option: YoutubeVideoOption = { optionId, beats, chapters }
  if (title) option.title = title
  if (chapterText) option.chapterText = chapterText
  return option
}

function parsePlan(raw: unknown): YoutubeVideoPlan | undefined {
  if (!isRecord(raw)) return undefined
  const options = Array.isArray(raw.options)
    ? raw.options.map(parseOption).filter((o): o is YoutubeVideoOption => !!o)
    : []
  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters.map(parseChapter).filter((c): c is YoutubeVideoChapter => !!c)
    : []
  const chapterText = str(raw.chapterText)
  const title = str(raw.title)
  const summary = str(raw.summary) ?? str(raw.description)
  const plan: YoutubeVideoPlan = { options, chapters }
  if (title) plan.title = title
  if (summary) plan.summary = summary
  if (chapterText) plan.chapterText = chapterText
  return plan
}

function parseError(raw: unknown): YoutubeVideoError | undefined {
  if (!isRecord(raw)) return undefined
  const code = str(raw.code) ?? 'ERROR'
  const message = sanitizeYoutubeVideoMessage(str(raw.message) ?? 'Something went wrong.')
  return { code, message }
}

function parseStatus(raw: unknown): YoutubeVideoStatus | null {
  const s = str(raw)
  if (s && (YOUTUBE_VIDEO_STATUSES as readonly string[]).includes(s)) return s as YoutubeVideoStatus
  return null
}

export function parseYoutubeVideoRun(input: unknown): YoutubeVideoRun {
  const root = isRecord(input) ? input : {}
  const raw = isRecord(root.run) ? { ...root, ...root.run } : root
  const runId = str(raw.runId) ?? str(raw.id)
  if (!runId) throw new Error('YouTube Video run is missing an id')
  const status = parseStatus(raw.status) ?? 'queued'
  const stage = str(raw.stage) ?? status
  const progress = num(raw.progress)
  const error = parseError(raw.error)
  const creditEstimate = num(raw.creditEstimate)
  const clipId = str(raw.clipId)
  const projectId = str(raw.projectId)
  const editorUrl =
    str(raw.editorUrl) ?? (projectId && clipId ? fallbackEditorUrl(projectId, clipId) : undefined)
  const durationMs = num(raw.durationMs)
  const playbackUrl = str(raw.playbackUrl)
  const thumbnailUrl = str(raw.thumbnailUrl)
  const downloadUrl = str(raw.downloadUrl)
  const plan = parsePlan(raw.planCard ?? raw.plan)
  const fromRun = Array.isArray(raw.options)
    ? raw.options.map(parseOption).filter((o): o is YoutubeVideoOption => !!o)
    : []
  const options = fromRun.length ? fromRun : (plan?.options ?? [])
  if (plan && !plan.options.length && options.length) plan.options = options
  const chosenOptionId = str(raw.chosenOptionId) ?? str(raw.chosenId)
  const run: YoutubeVideoRun = {
    runId,
    status,
    stage,
    options,
  }
  if (progress != null) run.progress = progress
  if (error) run.error = error
  if (creditEstimate != null) run.creditEstimate = creditEstimate
  if (clipId) run.clipId = clipId
  if (projectId) run.projectId = projectId
  if (editorUrl) run.editorUrl = editorUrl
  if (durationMs != null) run.durationMs = durationMs
  if (playbackUrl) run.playbackUrl = playbackUrl
  if (thumbnailUrl) run.thumbnailUrl = thumbnailUrl
  if (downloadUrl) run.downloadUrl = downloadUrl
  if (plan) run.plan = plan
  if (chosenOptionId) run.chosenOptionId = chosenOptionId
  return run
}

export function parseYoutubeVideoCreateResponse(input: unknown): YoutubeVideoRun {
  return parseYoutubeVideoRun(input)
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
  const err = isRecord(rec.error) ? rec.error : rec
  const code = str(err.code) ?? (status === 409 ? 'OPTION_ALREADY_CHOSEN' : 'ERROR')
  const message =
    str(err.message) ??
    str(rec.message) ??
    (status === 409
      ? 'A different option was already chosen.'
      : `Request failed (${status})`)
  return new YoutubeVideoHttpError(status, code, message)
}

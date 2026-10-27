/** ETA for non-streamer clip projects (worker rarely sends etaSeconds). */

export const TRANSCRIBE_RATE_DEEPGRAM = 0.03
export const TRANSCRIBE_RATE_LOCAL_WHISPER = 0.25
export const PICKER_ETA_SEC = 180
export const REFRAME_ETA_SEC_PER_CLIP = 60

export type TranscriptionEngine = 'deepgram' | 'local_whisper'

export function resolveTranscriptionEngine(settings?: Record<string, unknown> | null): TranscriptionEngine {
  const fromSettings = settings?.transcriptionEngine
  if (fromSettings === 'deepgram' || fromSettings === 'local_whisper') return fromSettings
  const explicit = String(process.env.TRANSCRIBE_PROVIDER || '').trim().toLowerCase()
  if (explicit === 'local') return 'local_whisper'
  if (explicit === 'deepgram') return 'deepgram'
  const hasKey = Boolean(process.env.DEEPGRAM_API_KEY?.trim())
  return hasKey ? 'deepgram' : 'local_whisper'
}

export function transcribeRate(engine: TranscriptionEngine): number {
  return engine === 'local_whisper' ? TRANSCRIBE_RATE_LOCAL_WHISPER : TRANSCRIBE_RATE_DEEPGRAM
}

import { clampEtaBetweenPolls } from '@/lib/clips/eta-poll'

export { clampEtaBetweenPolls } from '@/lib/clips/eta-poll'

function parseClipStage(stage: string | null | undefined): { current: number; total: number } | null {
  if (!stage) return null
  const m = stage.match(/^(?:reframe|render)_(\d+)_of_(\d+)$/i)
  if (!m) return null
  return { current: Number(m[1]), total: Number(m[2]) }
}

function estimatedClipCount(durationSec: number): number {
  if (durationSec <= 0) return 4
  return Math.min(12, Math.max(3, Math.ceil(durationSec / 120)))
}

function reframeRemainingSec(current: number, total: number): number {
  const remainingClips = Math.max(0, total - current + 1)
  return remainingClips * REFRAME_ETA_SEC_PER_CLIP
}

function tailAfterPickerSec(durationSec: number, stage: string | null | undefined): number {
  const clipStage = parseClipStage(stage)
  const clips = clipStage?.total ?? estimatedClipCount(durationSec)
  return clips * REFRAME_ETA_SEC_PER_CLIP
}

function transcribeRemainingSec(input: {
  durationSec: number
  engine: TranscriptionEngine
  chunkDone?: number
  chunkTotal?: number
  elapsedSec: number
}): number {
  const rate = transcribeRate(input.engine)
  const budget = input.durationSec * rate
  if (input.chunkTotal && input.chunkTotal > 0) {
    const done = input.chunkDone ?? 0
    const frac = Math.min(1, Math.max(0, done / input.chunkTotal))
    return Math.max(0, budget * (1 - frac))
  }
  // Flat progress during transcribe: decay budget with elapsed time (avoid elapsed×progress formula).
  return Math.max(30, budget - input.elapsedSec)
}

function progressBasedRemainingSec(elapsedSec: number, progress: number): number {
  if (progress <= 0) return 0
  return elapsedSec * (100 - progress) / progress
}

function stageAwareRemainingSec(input: {
  status: string
  stage: string | null | undefined
  progress: number
  durationSec: number
  engine: TranscriptionEngine
  chunkDone?: number
  chunkTotal?: number
  elapsedSec: number
}): number {
  const { status, stage, progress, durationSec, engine, elapsedSec } = input

  if (status === 'READY' || status === 'FAILED' || status === 'CANCELED') return 0

  const clipStage = parseClipStage(stage)
  if (clipStage) {
    return reframeRemainingSec(clipStage.current, clipStage.total)
  }

  if (status === 'REFRAMING' || status === 'RENDERING') {
    return tailAfterPickerSec(durationSec, stage)
  }

  if (status === 'FINDING_CLIPS' || status === 'SCANNING') {
    return PICKER_ETA_SEC + tailAfterPickerSec(durationSec, stage)
  }

  if (status === 'TRANSCRIBING') {
    const transcribe = transcribeRemainingSec({
      durationSec,
      engine,
      chunkDone: input.chunkDone,
      chunkTotal: input.chunkTotal,
      elapsedSec,
    })
    return transcribe + PICKER_ETA_SEC + tailAfterPickerSec(durationSec, stage)
  }

  if (status === 'PREPARING' || status === 'UPLOADING' || status === 'QUEUED' || status === 'DRAFT') {
    if (progress <= 0) return 0
    const transcribe = durationSec * transcribeRate(engine)
    return Math.max(60, transcribe + PICKER_ETA_SEC + tailAfterPickerSec(durationSec, stage))
  }

  if (progress > 0) {
    return progressBasedRemainingSec(elapsedSec, progress)
  }
  return 0
}

function useStageModel(input: {
  status?: string
  sourceDurationSec?: number
  stage?: string | null
  chunkTotal?: number
  progress: number
}): boolean {
  if (input.sourceDurationSec === undefined || input.sourceDurationSec <= 0) return false
  if (!input.status) return false
  if (input.status === 'TRANSCRIBING') {
    if (input.chunkTotal && input.chunkTotal > 0) return true
    return input.progress > 0 && input.progress < 45
  }
  if (input.status === 'FINDING_CLIPS' || input.status === 'SCANNING') return true
  if (input.status === 'REFRAMING' || input.status === 'RENDERING') return true
  if (parseClipStage(input.stage)) return true
  if (
    (input.status === 'PREPARING' || input.status === 'UPLOADING' || input.status === 'QUEUED') &&
    input.progress > 0
  ) {
    return true
  }
  return false
}

export function computeNonStreamerClipEtaSec(input: {
  progress: number
  createdAtMs: number
  nowMs?: number
  status?: string
  stage?: string | null
  sourceDurationSec?: number
  settings?: Record<string, unknown>
  chunkDone?: number
  chunkTotal?: number
  previousEtaSec?: number
}): number {
  const progress = input.progress
  const now = input.nowMs ?? Date.now()
  const elapsedSec = Math.max(1, (now - input.createdAtMs) / 1000)

  let raw = 0
  if (useStageModel(input)) {
    raw = stageAwareRemainingSec({
      status: input.status!,
      stage: input.stage,
      progress,
      durationSec: input.sourceDurationSec ?? 0,
      engine: resolveTranscriptionEngine(input.settings),
      chunkDone: input.chunkDone,
      chunkTotal: input.chunkTotal,
      elapsedSec,
    })
  } else if (progress > 0) {
    raw = progressBasedRemainingSec(elapsedSec, progress)
  }

  return clampEtaBetweenPolls(raw, input.previousEtaSec)
}

/** ETA for non-streamer clip projects (worker rarely sends etaSeconds). */

/** Deepgram ASR rate on source duration (measured on 25 min interview). */
export const TRANSCRIBE_RATE_DEEPGRAM = 0.05
/** Download + queue jitter on top of ASR budget (Deepgram stage ~1m15–1m50 total). */
export const DEEPGRAM_DOWNLOAD_BUFFER_SEC = 35
export const TRANSCRIBE_RATE_LOCAL_WHISPER = 0.25
/** Picker ~3 min at 25 min source; scales with source duration / transcript length proxy. */
export const PICKER_ETA_AT_REFERENCE_SEC = 180
export const PICKER_REFERENCE_DURATION_SEC = 25 * 60
export const REFRAME_ETA_SEC_PER_CLIP = 65
/** ~4 clips on a 25 min interview (proj_89c551…). */
export const CLIPS_PER_REFERENCE_DURATION = 4

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

export function resolveRenderConcurrency(): number {
  const raw = process.env.CLIPS_RENDER_CONCURRENCY
  const n = raw ? parseInt(raw, 10) : 2
  if (!Number.isFinite(n)) return 2
  return Math.max(1, Math.min(8, n))
}

export function pickerEtaSec(durationSec: number): number {
  if (durationSec <= 0) return PICKER_ETA_AT_REFERENCE_SEC
  const scaled = PICKER_ETA_AT_REFERENCE_SEC * (durationSec / PICKER_REFERENCE_DURATION_SEC)
  return Math.max(60, Math.round(scaled))
}

export function estimatedClipCount(durationSec: number): number {
  if (durationSec <= 0) return CLIPS_PER_REFERENCE_DURATION
  const scaled = (durationSec / PICKER_REFERENCE_DURATION_SEC) * CLIPS_PER_REFERENCE_DURATION
  return Math.min(12, Math.max(3, Math.round(scaled)))
}

/** Wall-clock reframe tail while clips are still in flight (parallel pool). */
export function reframeWallSec(clipCount: number, concurrency = resolveRenderConcurrency()): number {
  const clips = Math.max(1, clipCount)
  const conc = Math.max(1, concurrency)
  return Math.ceil(clips / conc) * REFRAME_ETA_SEC_PER_CLIP
}

/** Upfront reframe budget before parallelism (matches pre-parallel ~65s × clip serial wall). */
export function reframeTailEstimateSec(clipCount: number): number {
  return Math.max(1, clipCount) * REFRAME_ETA_SEC_PER_CLIP
}

function transcribeStageBudgetSec(durationSec: number, engine: TranscriptionEngine): number {
  const base = durationSec * transcribeRate(engine)
  if (engine === 'deepgram') return base + DEEPGRAM_DOWNLOAD_BUFFER_SEC
  return base
}

import { clampEtaBetweenPolls } from '@/lib/clips/eta-poll'

export { clampEtaBetweenPolls } from '@/lib/clips/eta-poll'

function parseClipStage(stage: string | null | undefined): { current: number; total: number } | null {
  if (!stage) return null
  const m = stage.match(/^(?:reframe|render)_(\d+)_of_(\d+)$/i)
  if (!m) return null
  return { current: Number(m[1]), total: Number(m[2]) }
}

function reframeRemainingSec(current: number, total: number): number {
  const remainingClips = Math.max(0, total - current + 1)
  return reframeWallSec(remainingClips)
}

function tailAfterPickerSec(durationSec: number, stage: string | null | undefined): number {
  const clipStage = parseClipStage(stage)
  const clips = clipStage?.total ?? estimatedClipCount(durationSec)
  return reframeTailEstimateSec(clips)
}

function pickerRemainingSec(stage: string | null | undefined, progress: number, durationSec: number): number {
  const budget = pickerEtaSec(durationSec)
  if (stage === 'picker_done') return 0
  if (stage === 'picker_pass1' || stage === 'finding_clips' || stage === 'vision_rank') {
    return budget
  }
  if (progress >= 52 && progress < 55) {
    const frac = Math.min(1, Math.max(0, (progress - 52) / 3))
    return Math.round(budget * (1 - frac))
  }
  return budget
}

function transcribeRemainingSec(input: {
  durationSec: number
  engine: TranscriptionEngine
  chunkDone?: number
  chunkTotal?: number
  elapsedSec: number
}): number {
  const budget = transcribeStageBudgetSec(input.durationSec, input.engine)
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
    return pickerRemainingSec(stage, progress, durationSec) + tailAfterPickerSec(durationSec, stage)
  }

  if (status === 'TRANSCRIBING') {
    const transcribe = transcribeRemainingSec({
      durationSec,
      engine,
      chunkDone: input.chunkDone,
      chunkTotal: input.chunkTotal,
      elapsedSec,
    })
    return transcribe + pickerEtaSec(durationSec) + tailAfterPickerSec(durationSec, stage)
  }

  if (status === 'PREPARING' || status === 'UPLOADING' || status === 'QUEUED' || status === 'DRAFT') {
    if (progress <= 0) return 0
    const transcribe = transcribeStageBudgetSec(durationSec, engine)
    return Math.max(
      60,
      transcribe + pickerEtaSec(durationSec) + tailAfterPickerSec(durationSec, stage),
    )
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

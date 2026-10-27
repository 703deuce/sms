import { describe, expect, it } from 'vitest'
import {
  clampEtaBetweenPolls,
  computeNonStreamerClipEtaSec,
  estimatedClipCount,
  pickerEtaSec,
  PICKER_ETA_AT_REFERENCE_SEC,
  reframeWallSec,
  REFRAME_ETA_SEC_PER_CLIP,
  DEEPGRAM_DOWNLOAD_BUFFER_SEC,
  reframeTailEstimateSec,
  TRANSCRIBE_RATE_DEEPGRAM,
  TRANSCRIBE_RATE_LOCAL_WHISPER,
} from '@/lib/server/clips/project-eta'

const INTERVIEW_25M_SEC = 25 * 60

describe('computeNonStreamerClipEtaSec', () => {
  it('hides ETA until progress starts', () => {
    expect(
      computeNonStreamerClipEtaSec({ progress: 0, createdAtMs: Date.now() - 600_000 }),
    ).toBe(0)
  })

  it('estimates from elapsed time and progress when stage model does not apply', () => {
    const createdAtMs = 1_000_000
    const nowMs = createdAtMs + 570_000 // 9.5 min elapsed
    const eta = computeNonStreamerClipEtaSec({ progress: 50, createdAtMs, nowMs })
    expect(eta).toBeGreaterThan(500)
    expect(eta).toBeLessThan(650)
  })

  it('uses duration×engine rate during flat TRANSCRIBING (not elapsed/progress blow-up)', () => {
    const durationSec = 14 * 60
    const createdAtMs = 0
    const nowMs = 10 * 60_000 // 10 min elapsed, progress stuck at 12%
    const eta = computeNonStreamerClipEtaSec({
      progress: 12,
      createdAtMs,
      nowMs,
      status: 'TRANSCRIBING',
      stage: 'transcribing',
      sourceDurationSec: durationSec,
      settings: { transcriptionEngine: 'local_whisper' },
    })
    const transcribeBudget = durationSec * TRANSCRIBE_RATE_LOCAL_WHISPER
    const tailPicker = pickerEtaSec(durationSec)
    const clips = estimatedClipCount(durationSec)
    const tailReframe = reframeWallSec(clips)
    const transcribeRem = Math.max(0, transcribeBudget - 600)
    const expected = Math.round(transcribeRem + tailPicker + tailReframe)
    expect(eta).toBe(expected)
    expect(eta).toBeLessThan(20 * 60)
    const naive = Math.round(600 * (100 - 12) / 12)
    expect(naive).toBeGreaterThan(eta * 3)
  })

  it('calibrates ~9–10 min for 25 min Deepgram interview at transcribe start (proj_89c551…)', () => {
    const durationSec = INTERVIEW_25M_SEC
    const eta = computeNonStreamerClipEtaSec({
      progress: 10,
      createdAtMs: 0,
      nowMs: 0,
      status: 'TRANSCRIBING',
      stage: 'transcribing',
      sourceDurationSec: durationSec,
      settings: { transcriptionEngine: 'deepgram' },
    })
    const transcribe = durationSec * TRANSCRIBE_RATE_DEEPGRAM + DEEPGRAM_DOWNLOAD_BUFFER_SEC
    const picker = PICKER_ETA_AT_REFERENCE_SEC
    const clips = estimatedClipCount(durationSec)
    const reframe = reframeWallSec(clips)
    const transcribeRem = Math.min(transcribe, transcribe * 0.85)
    expect(eta).toBeGreaterThanOrEqual(Math.round(transcribeRem + picker + reframe) - 3)
    expect(eta).toBeLessThanOrEqual(Math.round(transcribeRem + picker + reframe) + 3)
    expect(eta).toBeGreaterThanOrEqual(6 * 60)
    expect(eta).toBeLessThanOrEqual(7 * 60 + 30)
  })

  it('drops picker tail during FINDING_CLIPS without re-inflating to ~15 min', () => {
    const durationSec = INTERVIEW_25M_SEC
    const eta = computeNonStreamerClipEtaSec({
      progress: 53,
      createdAtMs: 0,
      nowMs: 90_000,
      status: 'FINDING_CLIPS',
      stage: 'picker_pass1',
      sourceDurationSec: durationSec,
      settings: { transcriptionEngine: 'deepgram' },
    })
    const picker = pickerEtaSec(durationSec)
    const reframe = reframeTailEstimateSec(estimatedClipCount(durationSec))
    expect(eta).toBeLessThanOrEqual(Math.round(picker + reframe + 30))
    expect(eta).toBeLessThan(12 * 60)
    const oldInflated = estimatedClipCount(25 * 60) * 60 + picker + 110
    expect(eta).toBeLessThan(oldInflated)
  })

  it('accounts for parallel reframe when stage is reframe_2_of_4', () => {
    const remaining = computeNonStreamerClipEtaSec({
      progress: 60,
      createdAtMs: 0,
      nowMs: 400_000,
      status: 'REFRAMING',
      stage: 'reframe_2_of_4',
      sourceDurationSec: INTERVIEW_25M_SEC,
      settings: { transcriptionEngine: 'deepgram' },
    })
    expect(remaining).toBe(reframeWallSec(3))
    expect(remaining).toBe(Math.ceil(3 / 2) * REFRAME_ETA_SEC_PER_CLIP)
  })
})

describe('clampEtaBetweenPolls', () => {
  it('never increases ETA within the same stage', () => {
    expect(clampEtaBetweenPolls(900, 400, 'FINDING_CLIPS:', 'FINDING_CLIPS:')).toBe(400)
    expect(clampEtaBetweenPolls(500, 400, 'TRANSCRIBING:', 'TRANSCRIBING:')).toBe(400)
    expect(clampEtaBetweenPolls(100, undefined)).toBe(100)
    expect(clampEtaBetweenPolls(200, 400, 'FINDING_CLIPS:', 'TRANSCRIBING:')).toBe(200)
    expect(clampEtaBetweenPolls(500, 400, 'FINDING_CLIPS:', 'TRANSCRIBING:')).toBe(400)
  })
})

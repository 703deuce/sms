import { describe, expect, it } from 'vitest'
import {
  clampEtaBetweenPolls,
  computeNonStreamerClipEtaSec,
  PICKER_ETA_SEC,
  REFRAME_ETA_SEC_PER_CLIP,
  TRANSCRIBE_RATE_LOCAL_WHISPER,
} from '@/lib/server/clips/project-eta'

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
    const tailPicker = PICKER_ETA_SEC
    const clipCount = Math.min(12, Math.max(3, Math.ceil(durationSec / 120)))
    const tailReframe = clipCount * REFRAME_ETA_SEC_PER_CLIP
    const transcribeRem = Math.max(30, transcribeBudget - 600)
    const expected = Math.round(transcribeRem + tailPicker + tailReframe)
    expect(eta).toBe(expected)
    expect(eta).toBeLessThan(20 * 60)
    const naive = Math.round(600 * (100 - 12) / 12)
    expect(naive).toBeGreaterThan(eta * 3)
  })
})

describe('clampEtaBetweenPolls', () => {
  it('caps ETA growth at 50% between polls', () => {
    expect(clampEtaBetweenPolls(900, 400)).toBe(600)
    expect(clampEtaBetweenPolls(500, 400)).toBe(500)
    expect(clampEtaBetweenPolls(100, undefined)).toBe(100)
  })
})

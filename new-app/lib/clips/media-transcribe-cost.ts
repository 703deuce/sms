import { costOf } from '@/lib/billing/entitlements'

/**
 * E5b: cost shown BEFORE an on-demand transcription of a project's own media runs.
 * Users see CREDITS only (EP1g, John t371u): same rate as processing — `process_minute` credits
 * per started audio minute (min 1). The USD figures below are internal (stored on the row for
 * cost tracking) and are never sent to or rendered in the browser.
 * The worker uses the existing path (Deepgram nova-3 primary; GPU / local Whisper fallback), billed
 * per audio minute. List price (pay-as-you-go, pre-recorded) $0.0043/min; prod can override with
 * CLIPS_TRANSCRIBE_USD_PER_MIN (server) — the worker records the actual cost on the row.
 */
export const MEDIA_TRANSCRIBE_USD_PER_MIN_DEFAULT = 0.0043
/** Shown when the media has no probed duration yet. */
export const MEDIA_TRANSCRIBE_UNKNOWN_DURATION_MS = 0

export function mediaTranscribeUsdPerMin(envValue?: string | null): number {
  const n = Number(envValue)
  return Number.isFinite(n) && n > 0 && n < 1 ? n : MEDIA_TRANSCRIBE_USD_PER_MIN_DEFAULT
}

/** Billed in whole seconds, minimum 15 s (short clips still cost a request). */
export function estimateMediaTranscribeUsd(durationMs: number, usdPerMin = MEDIA_TRANSCRIBE_USD_PER_MIN_DEFAULT): number {
  const sec = Math.max(15, Math.ceil(Math.max(0, durationMs) / 1000))
  return Math.round(((sec / 60) * usdPerMin) * 1e6) / 1e6
}

/** Credits for transcribing `durationMs` of audio: per started minute (15 s minimum → 1 minute). */
export function mediaTranscribeCredits(durationMs: number): number {
  const sec = Math.max(15, Math.ceil(Math.max(0, Number(durationMs) || 0) / 1000))
  return Math.max(1, Math.ceil(sec / 60)) * costOf('', 'process_minute')
}

export function formatMediaDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

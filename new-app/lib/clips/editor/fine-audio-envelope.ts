/**
 * SCRIPT_DOC3: 5 ms audio energy envelope of a clip, decoded in the browser (once per URL), for
 * cut-edge search. Skips files over MAX_BYTES (long media keeps the 25 ms peaks).
 */
import type { GapRmsSample } from '@/lib/clips/gap-audio-trim'

export const FINE_STEP_MS = 5
export const FINE_MAX_BYTES = 80_000_000

const cache = new Map<string, Promise<GapRmsSample[] | null>>()

/** Mono RMS per FINE_STEP_MS window; tMs = window centre in source ms (media time + offset). */
export function envelopeFromChannels(channels: Float32Array[], sampleRate: number, mediaOffsetMs: number): GapRmsSample[] {
  if (!channels.length || !(sampleRate > 0)) return []
  const win = Math.max(1, Math.round((sampleRate * FINE_STEP_MS) / 1000))
  const n = channels[0]!.length
  const out: GapRmsSample[] = []
  for (let i = 0; i < n; i += win) {
    const end = Math.min(n, i + win)
    let sum = 0
    for (const ch of channels) for (let j = i; j < end; j++) sum += ch[j]! * ch[j]!
    const rms = Math.sqrt(sum / ((end - i) * channels.length))
    out.push({ tMs: ((i + (end - i) / 2) / sampleRate) * 1000 + mediaOffsetMs, rms })
  }
  return out
}

export function loadFineEnvelope(url: string, mediaOffsetMs: number): Promise<GapRmsSample[] | null> {
  const key = `${url}|${mediaOffsetMs}`
  const hit = cache.get(key)
  if (hit) return hit
  const p = (async () => {
    try {
      if (typeof window === 'undefined') return null
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      const res = await fetch(url)
      if (!res.ok) return null
      const len = Number(res.headers.get('content-length') ?? 0)
      if (len > FINE_MAX_BYTES) return null
      const buf = await res.arrayBuffer()
      if (buf.byteLength > FINE_MAX_BYTES) return null
      const ctx = new Ctx()
      try {
        const audio = await ctx.decodeAudioData(buf)
        const chans: Float32Array[] = []
        for (let c = 0; c < Math.min(2, audio.numberOfChannels); c++) chans.push(audio.getChannelData(c))
        return envelopeFromChannels(chans, audio.sampleRate, mediaOffsetMs)
      } finally {
        void ctx.close()
      }
    } catch {
      return null
    }
  })()
  cache.set(key, p)
  return p
}

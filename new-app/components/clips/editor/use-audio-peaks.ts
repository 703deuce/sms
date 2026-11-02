'use client'

import { useEffect, useState } from 'react'
import { decodePeaksFile } from '@/lib/clips/editor/editor-assets'
import { detectBeats, monoSamples } from '@/lib/clips/editor/beats'

/** G2: `beatsMs` / `bpm` (media ms) when the hook was asked for beats (`opts.beats`). */
export type AudioPeaks = {
  peaks: number[]
  peaksPerSec: number
  durationMs: number
  beatsMs?: number[]
  bpm?: number
  /** Set when `opts.beats` — for strong-beat filtering (not sent to server). */
  beatSamples?: Float32Array
  beatSampleRate?: number
}

const EMPTY: AudioPeaks = { peaks: [], peaksPerSec: 0, durationMs: 0 }

/**
 * Normalised peak envelope over the whole media file (time-indexed, so lanes can slice it).
 * FV2: `opts.peaksUrl` (full videos) reads the worker's compact peaks file instead — the media is
 * never downloaded; `opts.skipDecode` disables the whole-file decode (long media, no peaks yet).
 */
export function useAudioPeaks(
  url: string | null | undefined,
  peaksPerSec = 40,
  maxBuckets = 12_000,
  opts?: { peaksUrl?: string | null; skipDecode?: boolean; beats?: boolean },
): AudioPeaks {
  const [state, setState] = useState<AudioPeaks>(EMPTY)
  const peaksUrl = opts?.peaksUrl ?? null
  const skipDecode = opts?.skipDecode === true
  const wantBeats = opts?.beats === true
  useEffect(() => {
    if (peaksUrl) {
      let cancelled = false
      void fetch(peaksUrl)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (cancelled) return
          const d = decodePeaksFile(j)
          setState(d ? { peaks: d.peaks, peaksPerSec: d.peaksPerSec, durationMs: d.durationMs } : EMPTY)
        })
        .catch(() => {
          if (!cancelled) setState(EMPTY)
        })
      return () => {
        cancelled = true
      }
    }
    if (!url || skipDecode) {
      setState(EMPTY)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        const ctx = new AudioContext()
        const decoded = await ctx.decodeAudioData(buf.slice(0))
        await ctx.close()
        const p = peaksFromSamples(decoded.getChannelData(0), decoded.duration, peaksPerSec, maxBuckets)
        // G2: local beat detection on the same decode (no extra download, no API).
        const mono = monoSamples(decoded)
        const grid = wantBeats ? detectBeats(mono, decoded.sampleRate) : null
        if (!cancelled) {
          setState(
            grid
              ? {
                  ...p,
                  beatsMs: grid.beatsMs,
                  bpm: grid.bpm,
                  beatSamples: mono,
                  beatSampleRate: decoded.sampleRate,
                }
              : p,
          )
        }
      } catch {
        if (!cancelled) setState(EMPTY)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [url, peaksPerSec, maxBuckets, peaksUrl, skipDecode, wantBeats])
  return state
}

/** Normalised peak envelope of one channel (`durationSec` long) at ~`peaksPerSec`. */
export function peaksFromSamples(ch: Float32Array, durationSec: number, peaksPerSec: number, maxBuckets = 12_000): AudioPeaks {
  const durationMs = durationSec * 1000
  const buckets = Math.max(1, Math.min(maxBuckets, Math.round(durationSec * peaksPerSec)))
  const block = Math.max(1, Math.floor(ch.length / buckets))
  const out: number[] = new Array(buckets)
  let max = 0.001
  for (let i = 0; i < buckets; i++) {
    let peak = 0
    const start = i * block
    const end = Math.min(ch.length, start + block)
    for (let j = start; j < end; j++) {
      const v = Math.abs(ch[j]!)
      if (v > peak) peak = v
    }
    out[i] = peak
    if (peak > max) max = peak
  }
  return { peaks: out.map((p) => p / max), peaksPerSec: buckets / Math.max(0.001, durationSec), durationMs }
}

/** Down-sample the peaks between media times [fromMs, toMs) into `bars` values. */
export function slicePeaks(p: AudioPeaks, fromMs: number, toMs: number, bars: number): number[] {
  if (!p.peaks.length || bars <= 0 || toMs <= fromMs) return []
  const out: number[] = []
  const i0 = (fromMs / 1000) * p.peaksPerSec
  const i1 = (toMs / 1000) * p.peaksPerSec
  const step = (i1 - i0) / bars
  for (let b = 0; b < bars; b++) {
    const a = Math.floor(i0 + b * step)
    const z = Math.max(a + 1, Math.floor(i0 + (b + 1) * step))
    let m = 0
    for (let i = Math.max(0, a); i < Math.min(p.peaks.length, z); i++) m = Math.max(m, p.peaks[i]!)
    out.push(m)
  }
  return out
}

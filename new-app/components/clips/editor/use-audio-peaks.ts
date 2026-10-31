'use client'

import { useEffect, useState } from 'react'

export type AudioPeaks = { peaks: number[]; peaksPerSec: number; durationMs: number }

const EMPTY: AudioPeaks = { peaks: [], peaksPerSec: 0, durationMs: 0 }

/** Normalised peak envelope over the whole media file (time-indexed, so lanes can slice it). */
export function useAudioPeaks(url: string | null | undefined, peaksPerSec = 40, maxBuckets = 12_000): AudioPeaks {
  const [state, setState] = useState<AudioPeaks>(EMPTY)
  useEffect(() => {
    if (!url) {
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
        const ch = decoded.getChannelData(0)
        const durationMs = decoded.duration * 1000
        const buckets = Math.max(1, Math.min(maxBuckets, Math.round(decoded.duration * peaksPerSec)))
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
        if (!cancelled) {
          setState({ peaks: out.map((p) => p / max), peaksPerSec: buckets / Math.max(0.001, decoded.duration), durationMs })
        }
      } catch {
        if (!cancelled) setState(EMPTY)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [url, peaksPerSec, maxBuckets])
  return state
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

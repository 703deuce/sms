'use client'

import { useEffect, useState } from 'react'

export function useAudioWaveformPeaks(audioUrl: string | null, buckets = 120): number[] {
  const [peaks, setPeaks] = useState<number[]>([])

  useEffect(() => {
    if (!audioUrl) {
      setPeaks([])
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch(audioUrl)
        const buf = await res.arrayBuffer()
        const ctx = new AudioContext()
        const decoded = await ctx.decodeAudioData(buf.slice(0))
        await ctx.close()
        const ch = decoded.getChannelData(0)
        const block = Math.max(1, Math.floor(ch.length / buckets))
        const out: number[] = []
        for (let i = 0; i < buckets; i++) {
          const start = i * block
          let peak = 0
          for (let j = start; j < Math.min(ch.length, start + block); j++) {
            peak = Math.max(peak, Math.abs(ch[j]))
          }
          out.push(peak)
        }
        const max = Math.max(...out, 0.001)
        if (!cancelled) setPeaks(out.map((p) => p / max))
      } catch {
        if (!cancelled) setPeaks([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [audioUrl, buckets])

  return peaks
}

'use client'

import { useEffect, useRef, useState } from 'react'

export const PEAK_FLOOR_DB = -60
export const PEAK_HOLD_MS = 1500

/** Peak level in dBFS from time-domain samples (−60 floor). */
export function peakDb(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]!)
    if (v > peak) peak = v
  }
  if (peak <= 1e-8) return PEAK_FLOOR_DB
  return Math.max(PEAK_FLOOR_DB, 20 * Math.log10(peak))
}

export function usePeakLevels(analysers: [AnalyserNode | null, AnalyserNode | null] | null) {
  const [levels, setLevels] = useState<[number, number]>([PEAK_FLOOR_DB, PEAK_FLOOR_DB])
  const holdRef = useRef<[number, number]>([PEAK_FLOOR_DB, PEAK_FLOOR_DB])
  const holdUntilRef = useRef(0)

  useEffect(() => {
    const [aL, aR] = analysers ?? [null, null]
    if (!aL || !aR) {
      setLevels([PEAK_FLOOR_DB, PEAK_FLOOR_DB])
      return
    }
    const bufL = new Float32Array(aL.fftSize)
    const bufR = new Float32Array(aR.fftSize)
    let raf = 0
    const tick = () => {
      aL.getFloatTimeDomainData(bufL)
      aR.getFloatTimeDomainData(bufR)
      const instant: [number, number] = [peakDb(bufL), peakDb(bufR)]
      const now = performance.now()
      const nextHold: [number, number] = [...holdRef.current]
      for (let i = 0; i < 2; i++) {
        if (instant[i]! >= nextHold[i]!) {
          nextHold[i] = instant[i]!
          holdUntilRef.current = now + PEAK_HOLD_MS
        }
      }
      if (now >= holdUntilRef.current) {
        nextHold[0] = Math.max(instant[0]!, nextHold[0]! - 0.5)
        nextHold[1] = Math.max(instant[1]!, nextHold[1]! - 0.5)
      }
      holdRef.current = nextHold
      setLevels(nextHold)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [analysers?.[0], analysers?.[1]])

  return levels
}

function barHeight(db: number) {
  const t = (db - PEAK_FLOOR_DB) / -PEAK_FLOOR_DB
  return 8 + Math.round(Math.max(0, Math.min(1, t)) * 28)
}

/** Stereo peak meter (−60…0 dBFS, peak-hold). */
export function AudioMeter({
  levels,
  voiceMetered = true,
}: {
  levels: [number, number]
  voiceMetered?: boolean
}) {
  return (
    <div className="flex items-end gap-1" data-testid="preview-vu" aria-label="Peak meter">
      {levels.map((db, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div
            className={`w-1.5 rounded-sm transition-[height] duration-75 ${db >= -1 ? 'bg-red-500' : 'bg-emerald-400'}`}
            style={{ height: `${barHeight(db)}px` }}
          />
        </div>
      ))}
      {!voiceMetered ? (
        <span className="max-w-[4.5rem] text-[11px] leading-tight text-muted-foreground">voice not metered</span>
      ) : null}
    </div>
  )
}

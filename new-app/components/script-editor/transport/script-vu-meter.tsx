'use client'

import { useEffect, useRef, useState } from 'react'

function useVuLevel(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [level, setLevel] = useState(0)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    const setup = async () => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!Ctx) return
        const ctx = new Ctx()
        ctxRef.current = ctx
        const src = ctx.createMediaElementSource(video)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        src.connect(analyser)
        analyser.connect(ctx.destination)
        const data = new Uint8Array(analyser.frequencyBinCount)

        const tick = () => {
          if (cancelled) return
          analyser.getByteTimeDomainData(data)
          let peak = 0
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs(data[i] - 128) / 128
            if (v > peak) peak = v
          }
          setLevel(peak)
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        /* CORS / already connected */
      }
    }
    void setup()

    return () => {
      cancelled = true
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [videoRef])

  const pct = Math.round(Math.min(1, level) * 100)
  const db = level > 0.001 ? (20 * Math.log10(level)).toFixed(1) : '−∞'
  return { pct, db }
}

/** Peak VU on preview canvas (§13). */
export function ScriptVuMeter({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const { pct, db } = useVuLevel(videoRef)
  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-0.5 rounded-md bg-black/50 px-2 py-1.5 backdrop-blur-sm"
      data-testid="script-vu-meter"
      title={`${db} dB`}
      aria-hidden
    >
      {[0.35, 0.55, 0.75, 0.95].map((thresh, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-emerald-400 transition-[height] duration-75"
          style={{
            height: `${8 + i * 4}px`,
            opacity: pct / 100 >= thresh ? 1 : 0.25,
          }}
        />
      ))}
      <span className="ml-1 text-[9px] tabular-nums text-white/80">{pct}</span>
    </div>
  )
}

/** Transport cluster VU (§13.3). */
export function ScriptTransportVuMeter({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const { pct, db } = useVuLevel(videoRef)
  return (
    <div
      className="flex items-center gap-1 pr-1"
      data-testid="script-transport-vu-meter"
      title={`VU ${db} dB`}
    >
      <span className="text-[10px] font-semibold text-muted-foreground">VU</span>
      <div className="flex flex-col gap-0.5">
        {[0, 1].map((ch) => (
          <div key={ch} className="h-[3px] w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-75"
              style={{ width: `${Math.max(4, pct * (ch === 0 ? 1 : 0.92))}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

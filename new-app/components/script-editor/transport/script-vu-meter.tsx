'use client'

import { useEffect, useRef, useState } from 'react'

/** Peak VU meter driven from preview video audio (Web Audio API). */
export function ScriptVuMeter({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
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
  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-0.5 rounded-md bg-black/50 px-2 py-1.5 backdrop-blur-sm"
      data-testid="script-vu-meter"
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

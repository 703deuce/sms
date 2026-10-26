'use client'

import { useEffect, useRef, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'

type ClipRange = { id: string; startMs: number; endMs: number; total: number }

type SignalsPayload = {
  combined: number[]
  clips: ClipRange[]
  hz: number
}

export function HypeTimeline({ vodId }: { vodId: string }) {
  const [data, setData] = useState<SignalsPayload | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    void clipsFetch<SignalsPayload>(`/api/streamer/vods/${vodId}/signals`).then(setData).catch(() => setData(null))
  }, [vodId])

  if (!data?.combined?.length) return null
  const max = Math.max(...data.combined, 0.01)
  const w = 800
  const h = 64
  const series = data.combined
  const points = series
    .map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * w
      const y = h - (v / max) * (h - 4)
      return `${x},${y}`
    })
    .join(' ')

  const durationMs = (data.combined.length / (data.hz || 1)) * 1000

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Hype timeline</p>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" points={points} />
        {data.clips.map((c) => {
          const x0 = (c.startMs / durationMs) * w
          const x1 = (c.endMs / durationMs) * w
          return (
            <rect
              key={c.id}
              x={x0}
              y={0}
              width={Math.max(2, x1 - x0)}
              height={h}
              fill="hsl(var(--primary))"
              opacity={0.15}
              className="cursor-pointer"
              onClick={() => document.getElementById(`clip-card-${c.id}`)?.scrollIntoView({ behavior: 'smooth' })}
            />
          )
        })}
      </svg>
    </div>
  )
}

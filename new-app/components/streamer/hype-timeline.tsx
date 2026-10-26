'use client'

import { useEffect, useRef, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'
import { Button } from '@/components/ui/button'

type ClipRange = { id: string; startMs: number; endMs: number; total: number }

type SignalsPayload = {
  combined: number[]
  series?: {
    audio?: number[] | null
    chat?: number[] | null
    viewerClips?: number[] | null
    transcript?: number[] | null
  }
  clips: ClipRange[]
  hz: number
}

type SeriesKey = 'combined' | 'audio' | 'chat' | 'viewerClips'

export function HypeTimeline({ vodId }: { vodId: string }) {
  const [data, setData] = useState<SignalsPayload | null>(null)
  const [active, setActive] = useState<SeriesKey>('combined')
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    void clipsFetch<SignalsPayload>(`/api/streamer/vods/${vodId}/signals`).then(setData).catch(() => setData(null))
  }, [vodId])

  const series =
    active === 'combined'
      ? data?.combined
      : active === 'audio'
        ? data?.series?.audio
        : active === 'chat'
          ? data?.series?.chat
          : data?.series?.viewerClips

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        Loading hype timeline…
      </div>
    )
  }
  if (!series?.length) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        Hype timeline will appear after analysis. If chat replay was unavailable, audio and transcript signals still
        drive clip picks.
      </div>
    )
  }
  const max = Math.max(...series, 0.01)
  const w = 800
  const h = 64
  const points = series
    .map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * w
      const y = h - (v / max) * (h - 4)
      return `${x},${y}`
    })
    .join(' ')

  const durationMs = (series.length / (data!.hz || 1)) * 1000

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Hype timeline</p>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['combined', 'Combined'],
              ['audio', 'Audio'],
              ['chat', 'Chat'],
              ['viewerClips', 'Viewer clips'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={active === key ? 'secondary' : 'ghost'}
              className="h-6 px-2 text-[10px]"
              onClick={() => setActive(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" points={points} />
        {data!.clips.map((c) => {
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

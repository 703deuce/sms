'use client'

import { useEffect, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'

export type StreamUsageView = {
  usedHours: number
  capHours: number | null
  periodStart: string
  vodCount?: number
  gpuHours?: number
}

export function StreamerUsageMeter({ initial }: { initial?: StreamUsageView | null }) {
  const [usage, setUsage] = useState<StreamUsageView | null>(initial ?? null)
  useEffect(() => {
    void clipsFetch<StreamUsageView>('/api/streamer/usage')
      .then(setUsage)
      .catch(() => {
        if (!initial) setUsage(null)
      })
  }, [initial])
  if (!usage) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Stream usage unavailable right now.
      </div>
    )
  }
  const cap = usage.capHours
  const pct = cap ? Math.min(100, (usage.usedHours / cap) * 100) : 0
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
      <div className="flex justify-between gap-2 font-medium text-foreground">
        <span>Stream hours this month</span>
        <span className="tabular-nums">
          {usage.usedHours.toFixed(1)}
          {cap != null ? ` / ${cap} h` : ' h (no cap)'}
        </span>
      </div>
      {cap != null ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

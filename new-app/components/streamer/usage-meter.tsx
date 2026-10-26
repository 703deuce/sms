'use client'

import { useEffect, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'

type Usage = { usedHours: number; capHours: number | null; periodStart: string }

export function StreamerUsageMeter() {
  const [usage, setUsage] = useState<Usage | null>(null)
  useEffect(() => {
    void clipsFetch<Usage>('/api/streamer/usage').then(setUsage).catch(() => setUsage(null))
  }, [])
  if (!usage) return null
  const cap = usage.capHours
  const pct = cap ? Math.min(100, (usage.usedHours / cap) * 100) : 0
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div className="flex justify-between">
        <span>Stream hours this month</span>
        <span>
          {usage.usedHours.toFixed(1)}
          {cap != null ? ` / ${cap} h` : ' (unlimited)'}
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

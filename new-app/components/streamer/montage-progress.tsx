'use client'

import { useCallback, useEffect, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ExternalLink } from 'lucide-react'

export type MontageRow = {
  id: string
  title: string
  status: string
  durationMs: number | null
  outputUrl: string | null
  posterUrl: string | null
  error: string | null
  createdAt: string
}

function statusLabel(status: string) {
  if (status === 'QUEUED') return 'Queued'
  if (status === 'RUNNING') return 'Rendering montage…'
  if (status === 'READY') return 'Ready'
  if (status === 'FAILED') return 'Failed'
  return status
}

export function MontageProgress({ projectId, pollKey = 0 }: { projectId: string; pollKey?: number }) {
  const [rows, setRows] = useState<MontageRow[]>([])

  const refresh = useCallback(async () => {
    try {
      const data = await clipsFetch<MontageRow[]>(`/api/streamer/montages?projectId=${encodeURIComponent(projectId)}`)
      setRows(data)
    } catch {
      /* keep last */
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh, pollKey])

  useEffect(() => {
    const active = rows.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING')
    if (!active) return
    const t = setInterval(() => void refresh(), 3000)
    return () => clearInterval(t)
  }, [rows, refresh])

  if (!rows.length) return null

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-medium text-foreground">Montages</p>
      <ul className="space-y-2">
        {rows.map((m) => {
          const processing = m.status === 'QUEUED' || m.status === 'RUNNING'
          return (
            <li key={m.id} className="space-y-1 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{m.title}</span>
                <span>{statusLabel(m.status)}</span>
              </div>
              {processing ? <Progress value={m.status === 'RUNNING' ? 40 : 8} className="h-1.5" /> : null}
              {m.error ? <p className="text-destructive">{m.error}</p> : null}
              {m.outputUrl ? (
                <Button size="sm" variant="outline" className="h-7 text-xs" render={<a href={m.outputUrl} target="_blank" rel="noreferrer" />}>
                  Download montage <ExternalLink className="ml-1 size-3" />
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

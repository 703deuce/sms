'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type RunPayload = {
  id: string
  status: string
  phase?: string | null
  resultProjectId?: string | null
  resultClipId?: string | null
  error?: string | null
  steps?: Array<{ tool: string; resultSummary?: string | null }>
}

export function RunProgress({ runId, onDone }: { runId: string; onDone?: () => void }) {
  const [run, setRun] = useState<RunPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const res = await fetch(`/api/ai-producer-agent/runs/${encodeURIComponent(runId)}`)
      if (!res.ok) return
      const json = (await res.json()) as { data?: { run?: RunPayload } }
      if (!cancelled) setRun(json.data?.run ?? null)
    }
    void tick()
    const id = window.setInterval(() => void tick(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [runId])

  const done = run?.status === 'ready' || run?.status === 'failed' || run?.status === 'canceled'
  useEffect(() => {
    if (done && run?.status === 'ready') onDone?.()
  }, [done, onDone, run?.status])

  const editorHref =
    run?.resultProjectId && run.resultClipId
      ? `/app/clips/${run.resultProjectId}/edit/${run.resultClipId}`
      : null

  return (
    <div className="space-y-3 text-sm" data-testid="ai-producer-agent-progress">
      <p>
        Status: <span className="font-medium">{run?.status ?? '…'}</span>
        {run?.phase ? ` · ${run.phase}` : ''}
      </p>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-muted-foreground">
        {(run?.steps ?? []).slice(-8).map((s, i) => (
          <li key={`${s.tool}-${i}`}>
            {s.tool}
            {s.resultSummary ? ` — ${s.resultSummary}` : ''}
          </li>
        ))}
      </ul>
      {run?.error ? <p className="text-destructive">{run.error}</p> : null}
      {editorHref ? (
        <Button size="sm" render={<Link href={editorHref} />} data-testid="ai-producer-agent-open-editor">
          Open in editor
        </Button>
      ) : null}
    </div>
  )
}

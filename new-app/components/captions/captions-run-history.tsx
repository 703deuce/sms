'use client'

import { useCallback, useEffect, useState } from 'react'
import { Captions, RefreshCcw } from 'lucide-react'
import { getAiCaptionsRun, listAiCaptionsRuns } from '@/lib/clips/ai-captions-api'
import { captionsProgressLabel, type AiCaptionsRun } from '@/lib/clips/ai-captions-contract'

type Props = {
  onSelect: (run: AiCaptionsRun) => void
  refreshToken?: string
  selectedRunId?: string
}

function historyTitle(item: AiCaptionsRun): string {
  const resolved = item.displayTitle?.trim() || item.sourceTitle?.trim()
  if (resolved) return resolved
  if (!item.createdAt) return 'Caption video'
  const parsed = Date.parse(item.createdAt)
  if (!Number.isFinite(parsed)) return 'Caption video'
  return `Caption video · ${new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(parsed))}`
}

export function CaptionsRunHistory({ onSelect, refreshToken, selectedRunId }: Props) {
  const [runs, setRuns] = useState<AiCaptionsRun[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    console.info('[ai-captions:history] list_begin')
    try {
      const rows = await listAiCaptionsRuns()
      console.info('[ai-captions:history] list_complete', { count: rows.length })
      setRuns(rows)
      setError(false)
    } catch (err) {
      console.error('[ai-captions:history] list_failed', err)
      setError(true)
    }
  }, [])

  useEffect(() => {
    console.info('[ai-captions:history] refresh_effect', { refreshToken })
    void refresh()
  }, [refresh, refreshToken])

  const select = async (id: string) => {
    console.info('[ai-captions:history] select_begin', { id })
    setLoading(id)
    try {
      const selected = await getAiCaptionsRun(id)
      console.info('[ai-captions:history] select_complete', { id, status: selected.status })
      onSelect(selected)
    } catch (err) {
      console.error('[ai-captions:history] select_failed', err)
      setError(true)
    } finally {
      setLoading(null)
    }
  }

  return (
    <section aria-label="Caption runs" className="flex flex-col gap-3" data-testid="ai-captions-run-list">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Your caption runs</h2>
        <button type="button" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => void refresh()}><RefreshCcw className="size-4" aria-hidden /> Refresh</button>
      </div>
      {error ? <p role="status" className="text-sm text-muted-foreground">Unable to load your run history. Select Refresh to try again.</p> : null}
      {runs.length === 0 && !error ? <p className="text-sm text-muted-foreground">Your captioned videos will appear here.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {runs.map((item) => {
          const title = historyTitle(item)
          return (
            <li key={item.runId}>
              <button type="button" aria-label={'Open caption run ' + title}
                disabled={loading === item.runId}
                onClick={() => void select(item.runId)}
                className={'flex w-full gap-3 rounded-lg border p-2 text-left hover:border-primary ' + (selectedRunId === item.runId ? 'border-primary' : 'border-border')}>
                <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {item.result?.thumbnailUrl ? (
                    <img alt="Caption video thumbnail" src={item.result.thumbnailUrl} className="h-full w-full object-cover" />
                  ) : item.result?.playbackUrl ? (
                    <video src={item.result.playbackUrl} preload="metadata" muted playsInline className="h-full w-full object-cover" aria-label="Caption video preview" />
                  ) : <Captions className="size-6 text-muted-foreground" aria-hidden />}
                </div>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">{captionsProgressLabel(item.status, item.stage)}</span>
                  {item.createdAt ? <span className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

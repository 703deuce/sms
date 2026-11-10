'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ClipProjectStatus } from '@prisma/client'
import { Panel } from '@/components/app/page-primitives'
import { Badge } from '@/components/ui/badge'
import { StreamerStageStepper } from '@/components/streamer/stage-stepper'
import { StreamerVodDiscardButton } from '@/components/streamer/streamer-vod-discard-button'
import { StreamerVodRetryButton } from '@/components/streamer/streamer-vod-retry-button'
import type { StreamerVodRow } from '@/lib/server/streamer/vod-list'
import { formatEtaSeconds } from '@/lib/clips/format-eta'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatEta(sec: number) {
  if (sec <= 0) return null
  if (sec < 90) return `~${sec}s`
  const min = Math.round(sec / 60)
  return min < 90 ? `~${min} min` : `~${Math.round(min / 60)}h`
}

function vodStatusBadge(status: ClipProjectStatus): { label: string; className: string } {
  if (status === 'READY') return { label: 'Ready', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' }
  if (status === 'FAILED' || status === 'CANCELED')
    return { label: 'Failed', className: 'bg-destructive/15 text-destructive' }
  if (status === 'QUEUED') return { label: 'Queued', className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' }
  return { label: 'Processing', className: 'bg-sky-500/15 text-sky-800 dark:text-sky-300' }
}

export function StreamerVodRowCard({
  row,
  showPipelineLabel = false,
}: {
  row: StreamerVodRow
  showPipelineLabel?: boolean
}) {
  const [errorOpen, setErrorOpen] = useState(false)
  const eta = formatEta(row.etaSec)
  const chunk =
    row.chunkDone != null && row.chunkTotal != null && row.chunkTotal > 0
      ? ` · chunk ${row.chunkDone}/${row.chunkTotal}`
      : ''
  const badge = vodStatusBadge(row.status)
  const terminal = row.status === 'READY' || row.status === 'FAILED' || row.status === 'CANCELED'
  useEffect(() => {
    if (terminal && (row.progress > 0 || row.chunkTotal || row.etaSec || row.waitingForWorker)) {
      console.info('[streamer:progress]', { projectId: row.projectId, action: 'hide_terminal_progress', status: row.status })
    }
  }, [terminal, row.projectId, row.progress, row.chunkTotal, row.etaSec, row.waitingForWorker, row.status])

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/clips/${row.projectId}`}
              className="min-w-0 max-w-full truncate text-sm font-semibold text-foreground hover:underline"
              title={row.title}
            >
              {row.title}
            </Link>
            <Badge variant="secondary" className={cn('shrink-0 border-0', badge.className)}>
              {badge.label}
            </Badge>
            {showPipelineLabel ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">{row.pipelineLabel}</span>
            ) : null}
            <span className="text-xs capitalize text-muted-foreground">{row.platform}</span>
          </div>
          {row.error && row.pipelinePhase === 'failed' ? (
            <div className="space-y-1">
              <p className={cn('text-xs text-destructive', !errorOpen && 'line-clamp-2')}>{row.error}</p>
              {row.error.length > 120 ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-primary hover:underline"
                  onClick={() => setErrorOpen((o) => !o)}
                >
                  {errorOpen ? 'Hide details' : 'Details'}
                </button>
              ) : null}
            </div>
          ) : null}
          {!terminal ? <StreamerStageStepper stage={row.stage} progress={row.waitingForWorker ? 0 : row.progress} /> : null}
          {!terminal && row.waitingForWorker ? (
            <p className="text-xs text-muted-foreground">
              Waiting for a worker
              {row.queuedElapsedSec != null && row.queuedElapsedSec > 0
                ? ` · ${formatEtaSeconds(row.queuedElapsedSec)}`
                : ''}
            </p>
          ) : !terminal && eta ? (
            <p className="text-xs text-muted-foreground">
              ETA {eta}
              {chunk}
            </p>
          ) : !terminal && (row.progress > 0 || (row.chunkTotal != null && row.chunkTotal > 0)) ? (
            <p className="text-xs text-muted-foreground">
              Processing{row.progress > 0 ? ` · ${row.progress}%` : ''}
              {chunk}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <StreamerVodRetryButton projectId={row.projectId} disabled={!row.canRetry} />
          <StreamerVodDiscardButton projectId={row.projectId} status={row.status} />
          {row.url ? (
            <a
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-end gap-1 text-xs text-muted-foreground hover:text-foreground sm:w-auto"
            >
              Source <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

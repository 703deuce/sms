'use client'

import { Inbox, LayoutGrid, List, LoaderCircle } from 'lucide-react'
import type { StudioJob, StudioJobStatus, StudioMediaKind, StudioModel } from '../../lib/ai-studio/contract'
import type { HistoryFilter, StudioController, StudioSessionState } from '../../lib/ai-studio/controller'
import { visibleHistory } from '../../lib/ai-studio/controller'
import { EmptyState } from '../app/page-primitives'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Skeleton } from '../ui/skeleton'
import { JobCard } from './job-card'
import { cn } from '../../lib/utils'

export function HistoryGrid({
  state,
  controller,
  density,
  onDensity,
}: {
  state: StudioSessionState
  controller: StudioController
  density: 'comfortable' | 'compact'
  onDensity: (d: 'comfortable' | 'compact') => void
}) {
  const jobs = visibleHistory(state)
  const loading = state.historyStatus === 'loading' && state.history.length === 0
  const err = state.historyError

  return (
    <section className="flex min-h-0 flex-1 flex-col" data-testid="studio-history" aria-label="History">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="mr-auto text-sm font-semibold">History</h2>
        <Select
          value={state.historyFilter.kind}
          onValueChange={(v) => v && controller.setHistoryFilter({ kind: v as HistoryFilter['kind'] })}
          items={[
            { value: 'all', label: 'All types' },
            { value: 'video', label: 'Video' },
            { value: 'image', label: 'Image' },
          ]}
        >
          <SelectTrigger aria-label="Filter by type" className="w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={state.historyFilter.status ?? 'all'}
          onValueChange={(v) => controller.setHistoryFilter({ status: !v || v === 'all' ? null : (v as StudioJobStatus) })}
          items={[
            { value: 'all', label: 'All statuses' },
            { value: 'queued', label: 'Queued' },
            { value: 'running', label: 'Generating' },
            { value: 'done', label: 'Done' },
            { value: 'failed', label: 'Failed' },
          ]}
        >
          <SelectTrigger aria-label="Filter by status" className="w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="running">Generating</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={state.historyFilter.modelId ?? 'all'}
          onValueChange={(v) => controller.setHistoryFilter({ modelId: !v || v === 'all' ? null : v })}
          items={[{ value: 'all', label: 'All models' }, ...state.models.map((m) => ({ value: m.id, label: m.label }))]}
        >
          <SelectTrigger aria-label="Filter by model" className="w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {state.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border p-0.5">
          <Button
            type="button"
            size="icon-xs"
            variant={density === 'comfortable' ? 'secondary' : 'ghost'}
            aria-label="Comfortable grid"
            aria-pressed={density === 'comfortable'}
            onClick={() => onDensity('comfortable')}
          >
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant={density === 'compact' ? 'secondary' : 'ghost'}
            aria-label="Compact grid"
            aria-pressed={density === 'compact'}
            onClick={() => onDensity('compact')}
          >
            <List className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className={gridClass(density)}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
          </div>
        ) : err ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
            {err.message}
            <div className="mt-3">
              <Button type="button" size="sm" variant="outline" onClick={() => void controller.refreshHistory()}>
                Try again
              </Button>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No generations yet"
            description="Write a prompt and click Generate. Finished jobs will show up here."
          />
        ) : (
          <>
            <div className={gridClass(density)}>
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  model={state.models.find((m) => m.id === job.modelId)}
                  density={density}
                  onOpen={() => controller.openDetail(job.id)}
                />
              ))}
            </div>
            {state.nextCursor && (
              <div className="mt-4 flex justify-center">
                <Button type="button" variant="outline" size="sm" disabled={state.historyStatus === 'loading'} onClick={() => void controller.loadMoreHistory()}>
                  {state.historyStatus === 'loading' ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function gridClass(density: 'comfortable' | 'compact') {
  return cn(
    'grid gap-3',
    density === 'compact'
      ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  )
}

void (0 as unknown as StudioMediaKind)

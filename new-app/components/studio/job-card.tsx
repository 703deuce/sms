'use client'

import { useEffect, useRef, useState } from 'react'
import type { StudioJob, StudioModel } from '../../lib/ai-studio/contract'
import { elapsedLabel, formatCredits, statusLabel } from '../../lib/ai-studio/format'
import { modelVisual } from '../../lib/ai-studio/catalog'
import { cn } from '../../lib/utils'

export function JobCard({
  job,
  model,
  onOpen,
  density = 'comfortable',
}: {
  job: StudioJob
  model?: StudioModel
  onOpen: () => void
  density?: 'comfortable' | 'compact'
}) {
  const reduced = usePrefersReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const isVideo = job.output?.kind === 'video' || (job.mode !== 'text_to_image' && !job.output)
  const preview = job.output?.previewUrl
  const failed = job.status === 'failed'
  const pending = job.status === 'queued' || job.status === 'running'
  const art = model ? modelVisual(model).art : undefined

  return (
    <button
      type="button"
      data-testid={`studio-job-${job.id}`}
      data-job-status={job.status}
      onClick={onOpen}
      onMouseEnter={() => {
        if (!reduced && preview && isVideo) void videoRef.current?.play().catch(() => {})
      }}
      onMouseLeave={() => {
        const el = videoRef.current
        if (el) {
          el.pause()
          el.currentTime = 0
        }
      }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors',
        'hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        failed && 'border-destructive/30',
      )}
    >
      <div className={cn('relative bg-secondary', density === 'compact' ? 'aspect-square' : 'aspect-video')}>
        {preview && job.status === 'done' && job.output?.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : preview && job.status === 'done' && job.output?.kind === 'video' ? (
          <video
            ref={videoRef}
            src={preview}
            muted
            loop
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full" style={{ background: art }} />
        )}
        {pending && <PendingOverlay job={job} />}
        {failed && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 px-3 text-center">
            <p className="text-xs font-medium text-destructive">{job.error?.message || 'Generation failed'}</p>
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {statusLabel(job.status)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-2.5">
        <p className="line-clamp-2 text-xs text-foreground">{job.prompt || 'Untitled'}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {model?.label ?? job.modelId}
          {job.resolution ? ` · ${job.resolution}` : ''}
          {job.durationSec ? ` · ${job.durationSec}s` : ''}
          {` · ${formatCredits(job.creditEstimate)}`}
        </p>
      </div>
    </button>
  )
}

function PendingOverlay({ job }: { job: StudioJob }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const started = job.startedAt || job.createdAt
  const elapsed = elapsedLabel(started, now)
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 px-3">
      <div className="h-1 w-2/3 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      </div>
      <p className="text-xs font-medium text-foreground" aria-live="polite">
        {job.status === 'queued' ? 'Queued' : 'Generating'}
        {elapsed ? ` · ${elapsed}` : ''}
      </p>
    </div>
  )
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

import Link from 'next/link'
import { Clock, Film, Loader2, Plus, Sparkles } from 'lucide-react'
import { CLIP_JOB_STATE, type ClipProjectStatusUi, ProjectStatusBadge } from '@/components/app/status'
import { DurationChip } from '@/components/clips/ui/duration-chip'
import { relativeTime } from '@/lib/clips/format'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { cn } from '@/lib/utils'

function isProcessing(status: string) {
  return status !== 'READY' && status !== 'FAILED' && status !== 'CANCELED' && status !== 'DRAFT'
}

export function ProjectCard({ project }: { project: ClipProjectListItem }) {
  const processing = isProcessing(project.status)
  const statusUi = CLIP_JOB_STATE[project.status as ClipProjectStatusUi]
  const stageLabel = project.stage?.replace(/_/g, ' ') || 'Processing'
  const overlayLabel = statusUi?.label ?? stageLabel
  const { clipCount, thumbUrl, durationMs } = project

  return (
    <Link
      href={`/app/clips/${project.id}`}
      data-testid="project-card"
      className={cn(
        'group block overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="relative aspect-video bg-muted">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-brand-gradient/20 bg-[length:24px_24px] bg-[image:linear-gradient(to_right,oklch(0.5_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0_0/0.04)_1px,transparent_1px)]">
            <Film className="size-8 text-muted-foreground" aria-hidden />
          </div>
        )}
        <div className="absolute left-2 top-2 z-10">
          <ProjectStatusBadge status={project.status} showSpinner={false} />
        </div>
        {durationMs > 0 && !processing && (
          <DurationChip ms={durationMs} />
        )}
        {processing && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-3 pt-10"
            aria-live="polite"
          >
            <Loader2 className="size-7 animate-spin text-white" aria-hidden />
            <span className="mt-2 text-center text-xs font-medium leading-snug text-white">{overlayLabel}</span>
            {stageLabel.toLowerCase() !== overlayLabel.toLowerCase() ? (
              <span className="mt-0.5 text-center text-[10px] text-white/80 capitalize">{stageLabel}</span>
            ) : null}
          </div>
        )}
      </div>
      <div className="p-3.5">
        <p className="line-clamp-1 text-sm font-medium group-hover:text-primary">{project.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3.5" aria-hidden />
            {clipCount} clip{clipCount === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {relativeTime(new Date(project.createdAt))}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function NewProjectTile() {
  return (
    <Link
      href="/app/clips/new"
      data-testid="project-card-new"
      className="grid aspect-video place-items-center rounded-xl border-2 border-dashed border-border transition hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-xl tile-primary">
          <Plus className="size-6" aria-hidden />
        </span>
        <span className="text-sm font-medium">New project</span>
      </div>
    </Link>
  )
}

export function ProjectGrid({ projects }: { projects: ClipProjectListItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-grid">
      <NewProjectTile />
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  )
}

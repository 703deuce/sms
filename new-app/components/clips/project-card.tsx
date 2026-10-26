import Link from 'next/link'
import type { ClipProject } from '@prisma/client'
import { Clock, Film, Loader2, Plus, Sparkles } from 'lucide-react'
import { ProjectStatusBadge } from '@/components/app/status'
import { relativeTime } from '@/lib/clips/format'
import { cn } from '@/lib/utils'

function isProcessing(status: string) {
  return status !== 'READY' && status !== 'FAILED' && status !== 'CANCELED' && status !== 'DRAFT'
}

export function ProjectCard({ project, clipCount }: { project: ClipProject; clipCount?: number }) {
  const processing = isProcessing(project.status)
  const step = project.stage?.replace(/_/g, ' ') || 'Processing'

  return (
    <Link
      href={`/app/clips/${project.id}`}
      data-testid="project-card"
      className={cn(
        'group block overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="relative aspect-video bg-muted">
        <div className="absolute inset-0 grid place-items-center bg-brand-gradient/20 bg-[length:24px_24px] bg-[image:linear-gradient(to_right,oklch(0.5_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0_0/0.04)_1px,transparent_1px)]">
          <Film className="size-8 text-muted-foreground" aria-hidden />
        </div>
        <div className="absolute left-2 top-2">
          <ProjectStatusBadge status={project.status} />
        </div>
        {processing && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="size-8 animate-spin" aria-hidden />
              <span className="text-xs font-medium capitalize">{step}</span>
            </div>
          </div>
        )}
      </div>
      <div className="p-3.5">
        <p className="line-clamp-1 text-sm font-medium group-hover:text-primary">{project.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {clipCount != null && (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-3.5" aria-hidden />
              {clipCount} clips
            </span>
          )}
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

export function ProjectGrid({ projects }: { projects: ClipProject[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-grid">
      <NewProjectTile />
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  )
}

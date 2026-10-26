import Link from 'next/link'
import type { ClipProject } from '@prisma/client'
import { Clapperboard, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function statusBucket(status: string): 'processing' | 'ready' | 'failed' | 'other' {
  if (status === 'READY') return 'ready'
  if (status === 'FAILED' || status === 'CANCELED') return 'failed'
  if (status === 'DRAFT') return 'other'
  return 'processing'
}

function StatusBadge({ status }: { status: string }) {
  const bucket = statusBucket(status)
  if (bucket === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        Ready
      </span>
    )
  }
  if (bucket === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
        Failed
      </span>
    )
  }
  if (bucket === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
        <Loader2 className="size-3 animate-spin" />
        Processing
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {status}
    </span>
  )
}

export function ProjectCard({ project }: { project: ClipProject }) {
  const created = new Date(project.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  return (
    <Link
      href={`/app/clips/${project.id}`}
      data-testid="project-grid"
      className={cn(
        'group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-card/80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Clapperboard className="size-5" />
        </div>
        <StatusBadge status={project.status} />
      </div>
      <div>
        <p className="line-clamp-2 font-medium leading-snug group-hover:text-primary">{project.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">Created {created}</p>
      </div>
    </Link>
  )
}

export function ProjectGrid({ projects }: { projects: ClipProject[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-grid">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  )
}

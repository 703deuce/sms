import Link from 'next/link'
import type { ClipProject } from '@prisma/client'
import { Clapperboard } from 'lucide-react'
import { ProjectStatusBadge } from '@/components/app/status'
import { cn } from '@/lib/utils'

export function ProjectCard({ project }: { project: ClipProject }) {
  const created = new Date(project.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  return (
    <Link
      href={`/app/clips/${project.id}`}
      data-testid="project-card"
      className={cn(
        'group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-card/80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Clapperboard className="size-5" />
        </div>
        <ProjectStatusBadge status={project.status} />
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

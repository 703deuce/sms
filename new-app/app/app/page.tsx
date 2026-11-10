import Link from 'next/link'
import { Clapperboard, Scissors } from 'lucide-react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { ProjectStatusBadge } from '@/components/app/status'
import { getClipsDriveProjects, getClipsWorkspaceId } from '@/lib/server/clips/drive-data'
import { t2vProjectHref } from '@/lib/t2v/project-link'
import { routes } from '../../lib/routes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Home' }

export default async function AppDashboardPage() {
  let projects: Awaited<ReturnType<typeof getClipsDriveProjects>> = []
  let loadError = false
  try {
    const workspaceId = await getClipsWorkspaceId()
    projects = await getClipsDriveProjects(workspaceId, { limit: 8 })
  } catch {
    loadError = true
  }
  const recent = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)

  return (
    <Page>
      <PageHeader title="Home" description="Open Clipper or the video editor. Recent projects are listed below." />
      <div className="grid gap-4 sm:grid-cols-2">
        <LauncherCard
          href={routes.clips()}
          icon={Scissors}
          title="Clipper"
          description="Projects, uploads, and stream clips."
          testId="app-launcher-clipper"
        />
        <LauncherCard
          href={routes.videoEditor()}
          icon={Clapperboard}
          title="Video Editor"
          description="Edit a full video or open an existing project."
          testId="app-launcher-video-editor"
        />
      </div>
      <section className="mt-8" aria-labelledby="recent-projects-heading">
        <h2 id="recent-projects-heading" className="text-sm font-medium text-foreground">
          Recent projects
        </h2>
        {loadError ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            Couldn&apos;t load recent projects. You can still open Clipper or the video editor.
          </p>
        ) : recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No projects yet.{' '}
            <Link href={routes.clipsNew()} className="text-primary underline-offset-2 hover:underline">
              Start in Clipper
            </Link>{' '}
            or{' '}
            <Link href={routes.videoEditorNew()} className="text-primary underline-offset-2 hover:underline">
              create a video editor project
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {recent.map((project) => (
              <li key={project.id}>
                <Link
                  href={project.sourceKind === 't2v' ? t2vProjectHref(project) : routes.project(project.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-medium">{project.title}</span>
                  <ProjectStatusBadge status={project.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  )
}

function LauncherCard({
  href,
  icon: Icon,
  title,
  description,
  testId,
}: {
  href: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  description: string
  testId: string
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </Link>
  )
}

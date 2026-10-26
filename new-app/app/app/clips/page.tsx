import Link from 'next/link'
import { Clapperboard, Plus, SearchX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, Page, PageHeader } from '@/components/app/page-primitives'
import { ProjectGrid } from '@/components/clips/project-card'
import { ProjectsAutoRefresh } from '@/components/clips/projects-auto-refresh'
import { ProjectsToolbar } from '@/components/clips/projects-toolbar'
import { listClipProjectsForPage } from '@/lib/server/clips/project-list'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Projects' }

function isProcessing(status: string) {
  return status !== 'READY' && status !== 'FAILED' && status !== 'CANCELED' && status !== 'DRAFT'
}

export default async function ClipsProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const workspaceId = await resolveWorkspaceId()
  const projects = await listClipProjectsForPage(workspaceId, {
    q,
    status,
    limit: 50,
  })
  const hasFilters = Boolean(q?.trim() || (status && status !== 'all'))
  const anyProcessing = projects.some((p) => isProcessing(p.status))

  return (
    <Page>
      <ProjectsAutoRefresh enabled={anyProcessing} />
      <PageHeader
        icon={Clapperboard}
        iconTone="brand"
        title="Projects"
        description="Your long videos and the clips we found in them."
        eyebrow={
          <span className="text-xs text-muted-foreground">
            {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        }
        actions={
          <Link href="/app/clips/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="size-4" />
            New project
          </Link>
        }
      />
      <ProjectsToolbar q={q} status={status} />
      {projects.length === 0 && !hasFilters ? (
        <EmptyState
          icon={Clapperboard}
          title="No projects yet"
          description="Upload a long video and we'll find the best moments."
          action={
            <Link href="/app/clips/new" className={buttonVariants()}>
              <Plus className="size-4" />
              New project
            </Link>
          }
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matches"
          description="Try a different search or filter."
          action={
            <Link href="/app/clips" className={buttonVariants({ variant: 'outline' })}>
              Clear filters
            </Link>
          }
        />
      ) : (
        <ProjectGrid projects={projects} />
      )}
    </Page>
  )
}

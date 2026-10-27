import { DriveHome } from '@/components/drive/drive-home'
import { ProjectsAutoRefresh } from '@/components/clips/projects-auto-refresh'
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
  const anyProcessing = projects.some((p) => isProcessing(p.status))

  return (
    <div className="p-4 md:p-6">
      <ProjectsAutoRefresh enabled={anyProcessing} />
      <DriveHome initialProjects={projects} q={q} status={status} />
    </div>
  )
}

import { DriveHome } from '@/components/drive/drive-home'
import { DriveProjectsSync } from '@/components/drive/drive-projects-sync'
import { ProjectsAutoRefresh } from '@/components/clips/projects-auto-refresh'
import { getClipsDriveFolders, getClipsDriveProjects, getClipsWorkspaceId } from '@/lib/server/clips/drive-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Projects' }

function isProcessing(status: string) {
  return status !== 'READY' && status !== 'FAILED' && status !== 'CANCELED' && status !== 'DRAFT'
}

export default async function ClipsProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; kind?: string; view?: string; folder?: string }>
}) {
  const { q, status, kind, folder, view } = await searchParams
  const workspaceId = await getClipsWorkspaceId()
  const [projects, folders] = await Promise.all([
    getClipsDriveProjects(workspaceId, {
      q,
      status,
      kind,
      limit: view === 'all' ? 200 : 50,
      folderId: folder ?? undefined,
    }),
    getClipsDriveFolders(workspaceId),
  ])
  const anyProcessing = projects.some((p) => isProcessing(p.status))

  return (
    <div className="p-4 md:p-6">
      <DriveProjectsSync projects={projects} />
      <ProjectsAutoRefresh enabled={anyProcessing} />
      <DriveHome initialProjects={projects} folders={folders} q={q} status={status} kind={kind} showAll={view === 'all'} />
    </div>
  )
}

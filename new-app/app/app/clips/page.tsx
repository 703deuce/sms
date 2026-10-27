import { DriveHome } from '@/components/drive/drive-home'
import { DriveSidebar } from '@/components/drive/drive-sidebar'
import { ProjectsAutoRefresh } from '@/components/clips/projects-auto-refresh'
import { listFolders } from '@/lib/server/clips/drive-projects'
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
  searchParams: Promise<{ q?: string; status?: string; view?: string; folder?: string }>
}) {
  const { q, status, folder, view } = await searchParams
  const workspaceId = await resolveWorkspaceId()
  const folderId = folder ? folder : undefined
  const [projects, folders] = await Promise.all([
    listClipProjectsForPage(workspaceId, {
      q,
      status,
      limit: view === 'all' ? 200 : 50,
      folderId: folder ?? undefined,
    }),
    listFolders(workspaceId),
  ])
  const anyProcessing = projects.some((p) => isProcessing(p.status))

  return (
    <div className="flex min-h-0 flex-1">
      <DriveSidebar folders={folders.map((f) => ({ id: f.id, name: f.name }))} />
      <div className="min-w-0 flex-1 p-4 md:p-6">
        <ProjectsAutoRefresh enabled={anyProcessing} />
        <DriveHome
          initialProjects={projects}
          q={q}
          status={status}
          showAll={view === 'all'}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
        />
      </div>
    </div>
  )
}

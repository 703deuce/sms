import { DriveHome } from '@/components/drive/drive-home'
import { DriveSidebar } from '@/components/drive/drive-sidebar'
import { listClipProjectsForPage } from '@/lib/server/clips/project-list'
import { listFolders } from '@/lib/server/clips/drive-projects'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Trash — Projects' }

export default async function ClipsTrashPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const workspaceId = await resolveWorkspaceId()
  const [projects, folders] = await Promise.all([
    listClipProjectsForPage(workspaceId, { q, trash: true, limit: 80 }),
    listFolders(workspaceId),
  ])

  return (
    <div className="flex min-h-0 flex-1">
      <DriveSidebar folders={folders.map((f) => ({ id: f.id, name: f.name }))} />
      <div className="min-w-0 flex-1 p-4 md:p-6">
        <DriveHome initialProjects={projects} q={q} pageView="trash" folders={folders.map((f) => ({ id: f.id, name: f.name }))} />
      </div>
    </div>
  )
}

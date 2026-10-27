import { DriveHome } from '@/components/drive/drive-home'
import { listClipProjectsForPage } from '@/lib/server/clips/project-list'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Trash — Projects' }

export default async function ClipsTrashPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const workspaceId = await resolveWorkspaceId()
  const projects = await listClipProjectsForPage(workspaceId, { q, trash: true, limit: 80 })

  return (
    <div className="p-4 md:p-6">
      <DriveHome initialProjects={projects} q={q} pageView="trash" />
    </div>
  )
}

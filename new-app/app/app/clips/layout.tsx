import { ClipsDriveShell } from '@/components/drive/clips-drive-shell'
import { listFolders } from '@/lib/server/clips/drive-projects'
import { listClipProjectsForPage } from '@/lib/server/clips/project-list'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const dynamic = 'force-dynamic'

export default async function ClipsSectionLayout({ children }: { children: React.ReactNode }) {
  const workspaceId = await resolveWorkspaceId()
  const [projects, folders] = await Promise.all([
    listClipProjectsForPage(workspaceId, { limit: 50 }),
    listFolders(workspaceId),
  ])

  return (
    <ClipsDriveShell
      projects={projects}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
    >
      {children}
    </ClipsDriveShell>
  )
}

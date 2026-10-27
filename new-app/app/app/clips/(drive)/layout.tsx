import { ClipsDriveShell } from '@/components/drive/clips-drive-shell'
import { getClipsDriveFolders, getClipsWorkspaceId } from '@/lib/server/clips/drive-data'

export const dynamic = 'force-dynamic'

export default async function ClipsDriveLayout({ children }: { children: React.ReactNode }) {
  const workspaceId = await getClipsWorkspaceId()
  const folders = await getClipsDriveFolders(workspaceId)

  return <ClipsDriveShell folders={folders}>{children}</ClipsDriveShell>
}

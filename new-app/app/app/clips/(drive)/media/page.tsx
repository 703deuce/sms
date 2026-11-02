import { Images } from 'lucide-react'
import { MediaLibraryView } from '@/components/drive/media-library-view'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { getClipsWorkspaceId } from '@/lib/server/clips/drive-data'
import { listMediaLibraryUploads } from '@/lib/server/clips/media-library'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Media library' }

export default async function ClipsMediaLibraryPage() {
  const workspaceId = await getClipsWorkspaceId()
  const uploads = await listMediaLibraryUploads(workspaceId)

  return (
    <Page>
      <PageHeader
        icon={Images}
        title="Media library"
        description="Workspace uploads you can attach to script-editor projects."
      />
      <MediaLibraryView uploads={uploads} />
    </Page>
  )
}

import { Images } from 'lucide-react'
import { MediaLibraryView } from '@/components/drive/media-library-view'
import { getClipsWorkspaceId } from '@/lib/server/clips/drive-data'
import { listMediaLibraryUploads } from '@/lib/server/clips/media-library'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Media library' }

export default async function ClipsMediaLibraryPage() {
  const workspaceId = await getClipsWorkspaceId()
  const uploads = await listMediaLibraryUploads(workspaceId)

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Images className="size-5 text-brand" aria-hidden />
          <h1 className="text-xl font-semibold">Media library</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace uploads you can attach to script-editor projects.
        </p>
      </header>
      <MediaLibraryView uploads={uploads} />
    </div>
  )
}

import { EditorPageSkeleton } from '../../../../../../components/clips/editor/editor-page-skeleton'
import { resolveWorkspaceId } from '../../../../../../lib/server/workspace'
import { Suspense } from 'react'
import { EditorPayloadSection } from './editor-payload-section'

export const metadata = { title: 'Edit clip' }

export default async function ClipEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; clipId: string }>
  searchParams: Promise<{ tab?: string; motionStudio?: string }>
}) {
  const { projectId, clipId } = await params
  const { tab, motionStudio } = await searchParams
  const workspaceId = await resolveWorkspaceId()

  return (
    <Suspense fallback={<EditorPageSkeleton />}>
      <EditorPayloadSection workspaceId={workspaceId} projectId={projectId} clipId={clipId} initialTab={tab} motionStudioProjectId={typeof motionStudio === 'string' && motionStudio ? motionStudio : null} />
    </Suspense>
  )
}

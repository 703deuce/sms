import { EditorPageSkeleton } from '@/components/clips/editor/editor-page-skeleton'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { Suspense } from 'react'
import { EditorPayloadSection } from './editor-payload-section'

export const metadata = { title: 'Edit clip' }

export default async function ClipEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; clipId: string }>
}) {
  const { projectId, clipId } = await params
  const workspaceId = await resolveWorkspaceId()

  return (
    <Suspense fallback={<EditorPageSkeleton />}>
      <EditorPayloadSection workspaceId={workspaceId} projectId={projectId} clipId={clipId} />
    </Suspense>
  )
}

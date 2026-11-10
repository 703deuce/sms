import { Suspense } from 'react'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { EditorPageSkeleton } from '@/components/clips/editor/editor-page-skeleton'
import { EditorPayloadSection } from './editor-payload-section'

export const metadata = { title: 'Story blocks editor' }

export default async function StoryBlocksEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; clipId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { projectId, clipId } = await params
  console.info('[editor:story-mode] route-entry', { projectId, clipId })
  const { from } = await searchParams
  const workspaceId = await resolveWorkspaceId()
  return (
    <Suspense fallback={<EditorPageSkeleton />}>
      <EditorPayloadSection
        workspaceId={workspaceId}
        projectId={projectId}
        clipId={clipId}
        clipperStudio={from === 'studio'}
      />
    </Suspense>
  )
}

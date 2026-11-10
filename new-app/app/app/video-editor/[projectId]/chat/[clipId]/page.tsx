import { Suspense } from 'react'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { EditorPageSkeleton } from '@/components/clips/editor/editor-page-skeleton'
import { EditorPayloadSection } from '../../text/[clipId]/editor-payload-section'

export const metadata = { title: 'Edit with AI' }

export default async function ChatEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; clipId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { projectId, clipId } = await params
  const { from } = await searchParams
  console.info('[editor:chat-mode] route-entry', { projectId, clipId })
  const workspaceId = await resolveWorkspaceId()
  return (
    <Suspense fallback={<EditorPageSkeleton />}>
      <EditorPayloadSection
        workspaceId={workspaceId}
        projectId={projectId}
        clipId={clipId}
        clipperStudio={from === 'studio'}
        chatMode
      />
    </Suspense>
  )
}

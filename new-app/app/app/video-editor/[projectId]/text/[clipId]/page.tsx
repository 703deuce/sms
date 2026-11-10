import { Suspense } from 'react'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { EditorPageSkeleton } from '@/components/clips/editor/editor-page-skeleton'
import { EditorPayloadSection } from './editor-payload-section'

export const metadata = { title: 'Text editor' }

export default async function TextEditorPage({ params }: { params: Promise<{ projectId: string; clipId: string }> }) {
  const { projectId, clipId } = await params
  console.info('[editor:text-mode] route-request', { projectId, clipId })
  const workspaceId = await resolveWorkspaceId()
  return <Suspense fallback={<EditorPageSkeleton />}><EditorPayloadSection workspaceId={workspaceId} projectId={projectId} clipId={clipId} /></Suspense>
}

import { Suspense } from 'react'
import { resolveWorkspaceId } from '../../../../../../lib/server/workspace'
import { EditorPageSkeleton } from '../../../../../../components/clips/editor/editor-page-skeleton'
import { EditorPayloadSection } from '../../edit/[clipId]/editor-payload-section'

export const metadata = { title: 'Clip Studio · Transovo' }

/** Dedicated streamer-first clipper UI. Shares the proven editing, autosave,
 * keyframe, real-time preview and export contract with the full editor.
 * The full-length editor retains its own route and its own default layout. */
export default async function ClipperStudioPage({
  params,
}: {
  params: Promise<{ projectId: string; clipId: string }>
}) {
  const { projectId, clipId } = await params
  const workspaceId = await resolveWorkspaceId()
  return (
    <Suspense fallback={<EditorPageSkeleton />}>
      <EditorPayloadSection workspaceId={workspaceId} projectId={projectId}
        clipId={clipId} clipperStudio />
    </Suspense>
  )
}

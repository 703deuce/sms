import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { EditorShell } from '@/components/clips/editor/editor-shell'
import { getClipEditorPayload } from '@/lib/server/clips/clip-detail'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Edit clip · Clips' }

export default async function ClipEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; clipId: string }>
}) {
  const { projectId, clipId } = await params
  const workspaceId = await resolveWorkspaceId()
  const data = await getClipEditorPayload(workspaceId, clipId)
  if (!data || data.clip.projectId !== projectId) notFound()

  const videoUrl = data.mediaUrls.proxy || data.mediaUrls.source || data.mediaUrls.preview
  const posterUrl = data.mediaUrls.poster || data.mediaUrls.preview

  return (
    <ClipperSurfaceErrorBoundary surface="Clip editor">
      <EditorShell
        projectId={projectId}
        projectTitle={data.project.title}
        clipId={clipId}
        initialTitle={data.clip.title}
        serverUpdatedAt={data.clip.updatedAt}
        editsSaveVersion={data.clip.editsSaveVersion}
        bounds={data.bounds}
        initialEdits={data.edits}
        words={data.words}
        cropShots={data.crop.shots}
        cropTrack={data.crop.track}
        videoUrl={videoUrl}
        posterUrl={posterUrl}
        aiMeta={data.aiMeta}
        brollMedia={data.brollMedia}
        reframeV2Enabled={data.capabilities.reframeV2Enabled}
        vodChat={data.vodChat}
        projectStatus={data.project.status}
      />
    </ClipperSurfaceErrorBoundary>
  )
}

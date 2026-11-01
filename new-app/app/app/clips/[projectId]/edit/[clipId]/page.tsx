import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { EditorShell } from '@/components/clips/editor/editor-shell'
import { getClipEditorPayload } from '@/lib/server/clips/clip-detail'
import { isFullVideoSettings } from '@/lib/clips/full-video'
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
  let data
  try {
    data = await getClipEditorPayload(workspaceId, clipId)
  } catch (err) {
    console.error('[clipper:editor-page] payload_failed', {
      clipId,
      projectId,
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
  if (!data || data.clip.projectId !== projectId) notFound()

  const videoUrl = data.media?.url ?? data.mediaUrls.proxy ?? data.mediaUrls.source ?? data.mediaUrls.preview
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
        facecamLayout={data.facecamLayout}
        videoUrl={videoUrl}
        editorMedia={data.media}
        posterUrl={posterUrl}
        aiMeta={data.aiMeta}
        brollMedia={data.brollMedia}
        reframeV2Enabled={data.capabilities.reframeV2Enabled}
        vodChat={data.vodChat}
        projectStatus={data.project.status}
        streamChannelId={data.streamChannelId}
        fullVideo={isFullVideoSettings(data.project.settings)}
        editorAssets={data.editorAssets ?? null}
      />
    </ClipperSurfaceErrorBoundary>
  )
}

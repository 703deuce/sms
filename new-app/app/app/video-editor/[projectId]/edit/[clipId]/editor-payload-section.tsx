import { EditorClipShell } from '../../../../../../components/clips/editor/editor-clip-shell'
import { isFullVideoSettings } from '../../../../../../lib/clips/full-video'
import { getClipEditorPayload } from '../../../../../../lib/server/clips/clip-detail'
import { notFound } from 'next/navigation'

export async function EditorPayloadSection({
  workspaceId,
  projectId,
  clipId,
  clipperStudio = false,
}: {
  workspaceId: string
  projectId: string
  clipId: string
  clipperStudio?: boolean
}) {
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

  const posterUrl = data.mediaUrls.poster || data.mediaUrls.preview

  return (
    <EditorClipShell
      key={`${projectId}:${clipId}`}
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
      primaryMedia={data.media}
      mediaUrls={{
        preview: data.mediaUrls.preview,
        poster: data.mediaUrls.poster,
        proxy: data.mediaUrls.proxy,
        source: data.mediaUrls.source,
        segment: data.mediaUrls.segment,
      }}
      sourceSegStartMs={data.sourceSegStartMs}
      sourceSegEndMs={data.sourceSegEndMs}
      clipStartMs={data.clip.startMs}
      clipEndMs={data.clip.endMs}
      posterUrl={posterUrl}
      aiMeta={data.aiMeta}
      brollMedia={data.brollMedia}
      reframeV2Enabled={data.capabilities.reframeV2Enabled}
      vodChat={data.vodChat}
      projectStatus={data.project.status}
      streamChannelId={data.streamChannelId}
      fullVideo={isFullVideoSettings(data.project.settings)}
      editorAssets={data.editorAssets ?? null}
      clipperStudio={clipperStudio}
    />
  )
}

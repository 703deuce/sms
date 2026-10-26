import { Page } from '@/components/app/page-primitives'
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

  return (
    <Page>
      <EditorShell
        projectId={projectId}
        clipId={clipId}
        initialTitle={data.clip.title}
        durationMs={data.clip.durationMs}
        clipStartMs={data.clip.startMs}
        initialEdits={data.edits}
        words={data.words}
        cropShots={data.crop.shots}
        videoUrl={videoUrl}
      />
    </Page>
  )
}

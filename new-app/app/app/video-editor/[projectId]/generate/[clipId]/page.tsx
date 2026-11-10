import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipEditorPayload } from '@/lib/server/clips/clip-detail'
import { isFullVideoSettings } from '@/lib/clips/full-video'
import { EditorPageSkeleton } from '@/components/clips/editor/editor-page-skeleton'
import { GenerateShotEditorShell } from '@/components/clips/editor/generate-shot-editor-shell'

export const metadata = { title: 'Change this shot · Transovo' }

function safeMs(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

async function GeneratePayload({
  projectId,
  clipId,
  atMs,
  startMs,
  endMs,
  fromStudio,
}: {
  projectId: string
  clipId: string
  atMs?: number
  startMs?: number
  endMs?: number
  fromStudio: boolean
}) {
  console.info('[editor:generate-mode] payload-request', { projectId, clipId })
  const workspaceId = await resolveWorkspaceId()
  const data = await getClipEditorPayload(workspaceId, clipId)
  if (!data || data.clip.projectId !== projectId) notFound()
  console.info('[editor:generate-mode] payload-ready', {
    projectId,
    clipId,
    hasOriginalSource: Boolean(data.mediaUrls.source || data.mediaUrls.segment),
  })
  return (
    <GenerateShotEditorShell
      projectId={projectId}
      projectTitle={data.project.title}
      clipId={clipId}
      initialTitle={data.clip.title}
      serverUpdatedAt={data.clip.updatedAt}
      editsSaveVersion={data.clip.editsSaveVersion}
      bounds={data.bounds}
      initialEdits={data.edits}
      words={data.words}
      mediaUrls={{
        preview: data.mediaUrls.preview,
        poster: data.mediaUrls.poster,
        proxy: data.mediaUrls.proxy,
        source: data.mediaUrls.source,
        segment: data.mediaUrls.segment,
      }}
      sourceSegStartMs={data.sourceSegStartMs}
      sourceSegEndMs={data.sourceSegEndMs}
      posterUrl={data.mediaUrls.poster || data.mediaUrls.preview}
      facecamLayout={data.facecamLayout}
      reframeV2Enabled={data.capabilities.reframeV2Enabled}
      aiMeta={data.aiMeta}
      fullVideo={isFullVideoSettings(data.project.settings)}
      initialAtMs={atMs}
      initialRange={startMs !== undefined && endMs !== undefined && startMs < endMs ? { startMs, endMs } : null}
      fromStudio={fromStudio}
    />
  )
}

export default async function GenerateShotPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; clipId: string }>
  searchParams: Promise<{ atMs?: string; startMs?: string; endMs?: string; from?: string }>
}) {
  const { projectId, clipId } = await params
  const query = await searchParams
  console.info('[editor:generate-mode] route-entry', { projectId, clipId, hasSelectedRange: Boolean(query.startMs && query.endMs) })
  return (
    <Suspense fallback={<EditorPageSkeleton />}>
      <GeneratePayload projectId={projectId} clipId={clipId} atMs={safeMs(query.atMs)}
        startMs={safeMs(query.startMs)} endMs={safeMs(query.endMs)} fromStudio={query.from === 'studio'} />
    </Suspense>
  )
}

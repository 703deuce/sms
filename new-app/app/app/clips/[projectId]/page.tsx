import { Page } from '@/components/app/page-primitives'
import { StreamHeader } from '@/components/streamer/stream-header'
import { StreamerProjectChrome } from '@/components/streamer/streamer-project-chrome'
import { ProjectClipsView } from '@/components/clips/project-clips-view'
import { listProjectClips } from '@/lib/server/clips/clips'
import { resolveViewOnFullVideoUrl } from '@/lib/server/clips/view-on-full-video'
import { blankProjectDisplayDurationMs, parseSettings } from '@/lib/server/clips/projects'
import { isFullVideoSettings } from '@/lib/clips/full-video'
import { getProjectStatus } from '@/lib/server/clips/jobs'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { isScriptEditorFeatureEnabled, isT2vFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { notFound, redirect } from 'next/navigation'

function reservedProjectSlugRedirects(): Record<string, string> {
  return {
    exports: '/app/exports',
    brand: '/app/clips/brand',
    new: '/app/clips/new',
    video: isT2vFeatureEnabled() ? '/app/ai-video/new' : '/app/clips',
  }
}

export const metadata = { title: 'Project · Clips' }

export default async function ClipProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const reserved = reservedProjectSlugRedirects()[projectId]
  if (reserved) redirect(reserved)
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const projectQueryStarted = Date.now()
  const projectP = prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true,
      title: true,
      status: true,
      stage: true,
      progress: true,
      error: true,
      settings: true,
      uploadId: true,
      sourceUrl: true,
      sourceKind: true,
      rangeStartMs: true,
      rangeEndMs: true,
      createdAt: true,
      transcriptKey: true,
      upload: { select: { storageDriver: true, durationMs: true } },
    },
  })

  const listOpts = { skipTranscriptEnrichment: true as const }

  const [project, upload, streamVod, initialClips, viewOnFullVideoUrl, liveStatus] = await Promise.all([
    projectP,
    // Upload duration is already selected by projectP; avoid a redundant DB read.
    projectP.then((p) => p?.upload ?? null),
    projectP.then(async (p) => {
      if (!p) return null
      const started = Date.now()
      const vod = await prisma.streamVod.findUnique({
        where: { projectId: p.id },
        select: {
          id: true, platform: true, title: true, category: true, url: true,
          chatSource: true, chatMessages: true, sourceDeletedAt: true,
          sourceType: true, state: true,
        },
      })
      console.info('[page:timing]', { path: '/app/clips/[projectId]', query: 'stream_vod', elapsedMs: Date.now() - started, rows: vod ? 1 : 0 })
      return vod
    }),
    projectP.then(async (p) => {
      if (!p) return null
      if (p.status === 'READY') {
        console.info('[page:timing]', { path: '/app/clips/[projectId]', query: 'ready_clip_urls_deferred', elapsedMs: 0, rows: 0 })
        return null
      }
      if (p.status === 'FAILED') {
        const started = Date.now()
        const n = await prisma.clip.count({ where: { projectId: p.id, deletedAt: null } })
        console.info('[page:timing]', { path: '/app/clips/[projectId]', query: 'failed_clip_count', elapsedMs: Date.now() - started, rows: n })
        if (n > 0) {
          return listProjectClips(workspaceId, p.id, 'score', {
            ...listOpts,
            project: {
              settings: p.settings,
              transcriptKey: p.transcriptKey,
              upload: p.upload ? { storageDriver: p.upload.storageDriver } : null,
            },
          })
        }
      }
      return null
    }),
    projectP.then((p) =>
      p ? (async () => {
        const started = Date.now()
        const url = await resolveViewOnFullVideoUrl(workspaceId, p.id, p.settings, p.uploadId, p.createdAt)
        console.info('[page:timing]', { path: '/app/clips/[projectId]', query: 'view_on_full_video', elapsedMs: Date.now() - started, rows: url ? 1 : 0 })
        return url
      })() : Promise.resolve(null),
    ),
    projectP.then((p) =>
      p && !['READY', 'FAILED', 'CANCELED'].includes(p.status) ? (async () => {
        const started = Date.now()
        const status = await getProjectStatus(workspaceId, p.id)
        console.info('[page:timing]', { path: '/app/clips/[projectId]', query: 'live_status', elapsedMs: Date.now() - started, rows: status ? 1 : 0 })
        return status
      })() : Promise.resolve(null),
    ),
  ])
  console.info('[page:timing]', {
    path: '/app/clips/[projectId]', query: 'project_and_dependencies',
    elapsedMs: Date.now() - projectQueryStarted,
    rows: project ? 1 : 0, clipRows: initialClips?.length ?? 0,
  })
  if (!project) notFound()
  if (project.sourceKind === 't2v') {
    if (!isT2vFeatureEnabled()) redirect('/app/clips')
    redirect(`/app/ai-video/${project.id}`)
  }

  const projectSettings = parseSettings(project.settings)

  const uploadDurationMs =
    upload && 'durationMs' in upload ? upload.durationMs : project.upload?.durationMs ?? null

  const sourceDurationMs = projectSettings.blank
    ? blankProjectDisplayDurationMs(project, uploadDurationMs, initialClips?.[0]?.edits)
    : Math.max(0, project.rangeEndMs - project.rangeStartMs)

  const vodState =
    streamVod?.state && typeof streamVod.state === 'object' && !Array.isArray(streamVod.state)
      ? (streamVod.state as Record<string, unknown>)
      : null
  const vodLayout = (vodState?.layout as Record<string, unknown> | undefined) ?? null
  const rollingLive =
    vodState?.rolling &&
    typeof vodState.rolling === 'object' &&
    !Array.isArray(vodState.rolling) &&
    (vodState.rolling as Record<string, unknown>).live === true
  const vodChatMeta =
    vodState?.chatMeta && typeof vodState.chatMeta === 'object' && !Array.isArray(vodState.chatMeta)
      ? (vodState.chatMeta as {
          available?: boolean
          messageCount?: number
          source?: string | null
          error?: string | null
        })
      : null

  return (
    <Page>
      {streamVod ? (
        <div className="mb-4 space-y-3">
          <StreamHeader
            platform={streamVod.platform}
            title={streamVod.title}
            category={streamVod.category}
            url={streamVod.url}
            chatSource={streamVod.chatSource}
            chatMessages={streamVod.chatMessages}
            chatError={typeof vodState?.chatError === 'string' ? vodState.chatError : null}
            chatMeta={vodChatMeta}
            projectStatus={project.status}
            sourceType={streamVod.sourceType}
          />
          <StreamerProjectChrome
            vodId={streamVod.id}
            projectId={project.id}
            stage={project.stage}
            progress={project.progress}
            projectStatus={project.status}
            sourceDeletedAt={streamVod.sourceDeletedAt?.toISOString() ?? null}
            layout={vodLayout}
            rollingLive={rollingLive}
          />
        </div>
      ) : null}
      <ProjectClipsView
        projectId={project.id}
        projectTitle={project.title}
        initialStatus={project.status}
        initialClips={initialClips}
        initialError={project.error}
        fromLink={Boolean(project.sourceUrl)}
        createdAt={project.createdAt.toISOString()}
        sourceDurationMs={sourceDurationMs}
        sourceStartMs={project.rangeStartMs}
        isStreamer={Boolean(streamVod)}
        initialProgress={liveStatus?.progress ?? 0}
        initialStage={liveStatus?.stage ?? null}
        initialEtaSec={liveStatus?.etaSec ?? 0}
        exportAspect={projectSettings.aspectRatio}
        scriptEditorEnabled={isScriptEditorFeatureEnabled()}
        byoProject={Boolean(projectSettings.byo)}
        viewOnFullVideoUrl={viewOnFullVideoUrl}
        asrLanguage={projectSettings.asrLanguage}
        editorProjectId={projectSettings.fromFullVideoProjectId ?? project.id}
        projectHasUpload={Boolean(project.uploadId && !isFullVideoSettings(projectSettings))}
        autoAgentClipMode={projectSettings.autoAgentClipMode}
        autoAgentClipError={typeof (project.settings as Record<string,unknown> | null)?.autoAgentClipError==='string' ? String((project.settings as Record<string,unknown>).autoAgentClipError) : undefined}
        autoAgentClipSeconds={projectSettings.autoAgentClipSeconds}
      />
    </Page>
  )
}

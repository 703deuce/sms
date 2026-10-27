import { Page } from '@/components/app/page-primitives'
import { StreamHeader } from '@/components/streamer/stream-header'
import { StreamerProjectChrome } from '@/components/streamer/streamer-project-chrome'
import { ProjectClipsView } from '@/components/clips/project-clips-view'
import { listProjectClips } from '@/lib/server/clips/clips'
import { getProjectStatus } from '@/lib/server/clips/jobs'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { notFound, redirect } from 'next/navigation'

const RESERVED_PROJECT_SLUGS: Record<string, string> = {
  exports: '/app/exports',
  brand: '/app/clips/brand',
  new: '/app/clips/new',
}

export const metadata = { title: 'Project · Clips' }

export default async function ClipProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const reserved = RESERVED_PROJECT_SLUGS[projectId]
  if (reserved) redirect(reserved)
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) notFound()

  const initialClips =
    project.status === 'READY' ? await listProjectClips(workspaceId, project.id, 'score') : null
  const liveStatus =
    project.status !== 'READY' ? await getProjectStatus(workspaceId, project.id) : null
  const streamVod = await prisma.streamVod.findUnique({ where: { projectId: project.id } })
  const vodState =
    streamVod?.state && typeof streamVod.state === 'object' && !Array.isArray(streamVod.state)
      ? (streamVod.state as Record<string, unknown>)
      : null
  const vodLayout = (vodState?.layout as Record<string, unknown> | undefined) ?? null

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
        sourceDurationMs={Math.max(0, project.rangeEndMs - project.rangeStartMs)}
        isStreamer={Boolean(streamVod)}
        initialProgress={liveStatus?.progress ?? 0}
        initialStage={liveStatus?.stage ?? null}
        initialEtaSec={liveStatus?.etaSec ?? 0}
      />
    </Page>
  )
}

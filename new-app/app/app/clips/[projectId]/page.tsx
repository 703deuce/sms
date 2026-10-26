import { Page } from '@/components/app/page-primitives'
import { StreamHeader } from '@/components/streamer/stream-header'
import { StreamerProjectChrome } from '@/components/streamer/streamer-project-chrome'
import { ProjectClipsView } from '@/components/clips/project-clips-view'
import { listProjectClips } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Project · Clips' }

export default async function ClipProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) notFound()

  const initialClips =
    project.status === 'READY' ? await listProjectClips(workspaceId, project.id, 'score') : null
  const streamVod = await prisma.streamVod.findUnique({ where: { projectId: project.id } })

  return (
    <Page>
      {streamVod ? (
        <div className="mb-4 space-y-3">
          <StreamHeader
            platform={streamVod.platform}
            title={streamVod.title}
            category={streamVod.category}
            url={streamVod.url}
          />
          <StreamerProjectChrome
            vodId={streamVod.id}
            stage={project.stage}
            progress={project.progress}
            sourceDeletedAt={streamVod.sourceDeletedAt?.toISOString() ?? null}
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
      />
    </Page>
  )
}

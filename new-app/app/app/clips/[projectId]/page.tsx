import { Page } from '@/components/app/page-primitives'
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

  return (
    <Page>
      <ProjectClipsView
        projectId={project.id}
        projectTitle={project.title}
        initialStatus={project.status}
        initialClips={initialClips}
        initialError={project.error}
        fromLink={Boolean(project.sourceUrl)}
      />
    </Page>
  )
}

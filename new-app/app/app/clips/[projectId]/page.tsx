import { Page, PageHeader } from '@/components/app/page-primitives'
import { ProjectResults } from '@/components/clips/project-results'
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

  const desc =
    project.status === 'READY'
      ? 'Your clips are ready.'
      : project.status === 'FAILED'
        ? project.error || 'Processing failed.'
        : 'Processing your source video.'

  return (
    <Page>
      <PageHeader title={project.title} description={desc} />
      <ProjectResults projectId={project.id} initialStatus={project.status} />
    </Page>
  )
}

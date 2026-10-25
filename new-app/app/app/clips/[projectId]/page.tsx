import { Page, PageHeader } from '@/components/app/page-primitives'
import { JobStatus } from '@/components/clips/job-status'
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

  return (
    <Page>
      <PageHeader title={project.title} description="Processing your source video." />
      <JobStatus projectId={project.id} initialStatus={project.status} />
    </Page>
  )
}

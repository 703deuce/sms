import { Page } from '@/components/app/page-primitives'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Video studio · Clips' }

export default async function T2vStudioPage({ params }: { params: Promise<{ projectId: string }> }) {
  if (!isT2vFeatureEnabled()) notFound()
  const { projectId } = await params
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, sourceKind: 't2v' },
    select: { id: true, title: true },
  })
  if (!project) notFound()
  return (
    <Page>
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
        <p className="mt-2 text-muted-foreground">T2V studio UI ships in milestones M2–M6.</p>
      </div>
    </Page>
  )
}

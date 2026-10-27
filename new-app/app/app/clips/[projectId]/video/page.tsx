import { Page } from '@/components/app/page-primitives'
import { T2vScriptReview } from '@/components/t2v/t2v-script-review'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Video studio · Clips' }

export default async function T2vStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  if (!isT2vFeatureEnabled()) notFound()
  const { projectId } = await params
  const { mode } = await searchParams
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const draft = await prisma.t2vDraft.findFirst({
    where: { projectId, workspaceId },
  })
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, sourceKind: 't2v' },
    select: { id: true, title: true },
  })
  if (!project || !draft) notFound()

  if (mode === 'script') {
    return (
      <Page>
        <T2vScriptReview
          draftId={draft.id}
          initialRevision={draft.revision}
          initialDocument={draft.document as T2vDraftV1}
        />
      </Page>
    )
  }

  return (
    <Page>
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
        <p className="mt-2 text-muted-foreground">Storyboard and build UI land in M4–M6.</p>
      </div>
    </Page>
  )
}

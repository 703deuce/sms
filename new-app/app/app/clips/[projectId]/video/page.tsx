import { Page } from '@/components/app/page-primitives'
import { T2vScriptReview } from '@/components/t2v/t2v-script-review'
import { T2vStoryboard } from '@/components/t2v/t2v-storyboard'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { notFound } from 'next/navigation'
import { T2vStudioBuildingBanner, T2vStudioToolbar } from '@/components/t2v/t2v-studio-toolbar'

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
    select: { id: true, title: true, status: true, rangeEndMs: true },
  })
  if (!project || !draft) notFound()
  const doc = draft.document as T2vDraftV1
  const composition = await prisma.scriptComposition.findFirst({
    where: { projectId, workspaceId, kind: 'FULL', clipId: null, deletedAt: null },
    select: { id: true },
  })
  const studioMode = mode === 'storyboard' ? 'storyboard' : 'script'
  const storyboardStale =
    composition != null && draft.assembledRevision != null && draft.assembledRevision < draft.revision
  const toolbar = (
    <>
      <T2vStudioToolbar
        projectId={project.id}
        title={project.title}
        mode={studioMode}
        compositionId={composition?.id ?? null}
        durationMs={project.rangeEndMs || 0}
        aspect={doc.settings.aspect}
        projectStatus={project.status}
        storyboardStale={storyboardStale}
      />
      {draft.status === 'ASSEMBLING' ? <T2vStudioBuildingBanner progress={draft.progress} /> : null}
    </>
  )

  if (mode === 'storyboard') {
    return (
      <Page className="flex min-h-0 flex-col p-0">
        {toolbar}
        <T2vStoryboard draftId={draft.id} projectId={project.id} document={doc} />
      </Page>
    )
  }

  return (
    <Page className="p-0">
      {toolbar}
      <T2vScriptReview
        draftId={draft.id}
        projectId={project.id}
        initialRevision={draft.revision}
        initialDocument={doc}
      />
    </Page>
  )
}

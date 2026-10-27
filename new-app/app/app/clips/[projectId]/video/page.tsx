import { Page } from '@/components/app/page-primitives'
import { T2vScriptReview } from '@/components/t2v/t2v-script-review'
import { T2vStoryboard } from '@/components/t2v/t2v-storyboard'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import Link from 'next/link'
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
  const doc = draft.document as T2vDraftV1

  const topBar = (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/app/clips" className="text-muted-foreground hover:text-foreground">← Drive</Link>
        <span className="font-medium">{project.title}</span>
      </div>
      <div className="flex gap-2 text-sm">
        <Link
          href={`/app/clips/${projectId}/video?mode=script`}
          className={mode === 'script' || !mode ? 'font-medium text-foreground' : 'text-muted-foreground'}
        >
          Script
        </Link>
        <Link
          href={`/app/clips/${projectId}/video?mode=storyboard`}
          className={mode === 'storyboard' ? 'font-medium text-foreground' : 'text-muted-foreground'}
        >
          Storyboard
        </Link>
        {project && (
          <Link href={`/app/clips/${projectId}/script`} className="text-primary">
            Open editor
          </Link>
        )}
      </div>
    </div>
  )

  if (mode === 'storyboard') {
    return (
      <Page className="flex min-h-0 flex-col p-0">
        {topBar}
        <T2vStoryboard draftId={draft.id} projectId={project.id} document={doc} />
      </Page>
    )
  }

  return (
    <Page className="p-0">
      {topBar}
      <T2vScriptReview
        draftId={draft.id}
        projectId={project.id}
        initialRevision={draft.revision}
        initialDocument={doc}
      />
    </Page>
  )
}

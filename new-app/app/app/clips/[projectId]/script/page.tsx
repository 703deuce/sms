import { ScriptEditorEntry } from '@/components/script-editor/script-editor-entry'
import { T2vEditorStaleBanner } from '@/components/t2v/t2v-editor-stale-banner'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Script · Clips' }

export default async function ProjectScriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ clipId?: string }>
}) {
  const { projectId } = await params
  const { clipId } = await searchParams
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) notFound()

  let storyboardStale = false
  if (project.sourceKind === 't2v') {
    const draft = await prisma.t2vDraft.findFirst({ where: { projectId, workspaceId } })
    const composition = await prisma.scriptComposition.findFirst({
      where: { projectId, workspaceId, kind: 'FULL', clipId: null, deletedAt: null },
      select: { id: true },
    })
    storyboardStale =
      Boolean(composition && draft && draft.assembledRevision != null && draft.assembledRevision < draft.revision)
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden">
      {storyboardStale ? <T2vEditorStaleBanner projectId={project.id} /> : null}
      <ScriptEditorEntry projectId={project.id} projectTitle={project.title} clipId={clipId ?? null} />
    </div>
  )
}

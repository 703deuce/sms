import { Page } from '@/components/app/page-primitives'
import { ScriptEditorEntry } from '@/components/script-editor/script-editor-entry'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Script · Clips' }

export default async function ProjectScriptPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) notFound()

  return (
    <Page>
      <ScriptEditorEntry projectId={project.id} projectTitle={project.title} />
    </Page>
  )
}

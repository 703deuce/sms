import Link from 'next/link'
import { Page, PageHeader } from '../../../components/app/page-primitives'
import { Button } from '../../../components/ui/button'
import { ProjectStatusBadge } from '../../../components/app/status'
import { ProjectsAutoRefresh } from '../../../components/clips/projects-auto-refresh'
import { getClipsDriveProjects, getClipsWorkspaceId } from '../../../lib/server/clips/drive-data'
import { isClipProjectProcessing } from '../../../lib/clips/project-processing'
import { isScriptEditorFeatureEnabled } from '../../../lib/server/clips/feature-gates'
import { routes } from '../../../lib/routes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Editor' }

export default async function ScriptEditorHubPage() {
  const scriptOn = isScriptEditorFeatureEnabled()
  const workspaceId = await getClipsWorkspaceId()
  const projects = await getClipsDriveProjects(workspaceId, { limit: 60 })
  const anyProcessing = projects.some((p: { status: string }) => isClipProjectProcessing(p.status))

  const sorted = [...projects].sort((a: { status: string; updatedAt: string | Date }, b: { status: string; updatedAt: string | Date }) => {
    const aProc = isClipProjectProcessing(a.status) ? 0 : 1
    const bProc = isClipProjectProcessing(b.status) ? 0 : 1
    if (aProc !== bProc) return aProc - bProc
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const openable = sorted.filter(
    (p: { status: string }) => p.status === 'READY' || isClipProjectProcessing(p.status) || p.status === 'DRAFT',
  )

  return (
    <Page>
      <ProjectsAutoRefresh enabled={anyProcessing} />
      <PageHeader
        title="Editor"
        description="Open a project to edit"
        actions={
          <Button render={<Link href={routes.videoEditorNew()} />}>New editor project</Button>
        }
      />
      {openable.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects yet.{' '}
          <Link href={routes.videoEditorNew()} className="text-primary underline-offset-2 hover:underline">
            Create a project
          </Link>{' '}
          or{' '}
          <Link href="/app/clips/media" className="text-primary underline-offset-2 hover:underline">
            upload in Media library
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {openable.map((p: { id: string; title: string; status: string }) => (
            <li key={p.id}>
              <Link
                href={scriptOn ? routes.script(p.id) : routes.project(p.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{p.title}</span>
                <span className="flex items-center gap-2">
                  <ProjectStatusBadge status={p.status} />
                  <span className="text-xs text-muted-foreground">Open →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

import Link from 'next/link'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { ProjectStatusBadge } from '@/components/app/status'
import { ProjectsAutoRefresh } from '@/components/clips/projects-auto-refresh'
import { getClipsDriveProjects, getClipsWorkspaceId } from '@/lib/server/clips/drive-data'
import { isClipProjectProcessing } from '@/lib/clips/project-processing'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Script editor' }

export default async function ScriptEditorHubPage() {
  const workspaceId = await getClipsWorkspaceId()
  const projects = await getClipsDriveProjects(workspaceId, { limit: 60 })
  const anyProcessing = projects.some((p) => isClipProjectProcessing(p.status))

  const sorted = [...projects].sort((a, b) => {
    const aProc = isClipProjectProcessing(a.status) ? 0 : 1
    const bProc = isClipProjectProcessing(b.status) ? 0 : 1
    if (aProc !== bProc) return aProc - bProc
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const openable = sorted.filter(
    (p) => p.status === 'READY' || isClipProjectProcessing(p.status) || p.status === 'DRAFT',
  )

  return (
    <Page>
      <ProjectsAutoRefresh enabled={anyProcessing} />
      <PageHeader
        title="Script editor"
        description="Open a project to edit the full transcript and composition. Processing projects open into a transcribing state until words are ready."
      />
      {openable.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects yet.{' '}
          <Link href="/app/clips/new" className="text-primary underline-offset-2 hover:underline">
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
          {openable.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/clips/${p.id}/script`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{p.title}</span>
                <span className="flex items-center gap-2">
                  <ProjectStatusBadge status={p.status} />
                  <span className="text-xs text-muted-foreground">Open script →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

import Link from 'next/link'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { getClipsDriveProjects, getClipsWorkspaceId } from '@/lib/server/clips/drive-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Script editor' }

export default async function ScriptEditorHubPage() {
  const workspaceId = await getClipsWorkspaceId()
  const projects = await getClipsDriveProjects(workspaceId, { limit: 40 })

  const editable = projects.filter((p) => p.status === 'READY')

  return (
    <Page title="Script editor" description="Open a project to edit the full transcript and composition.">
      <PageHeader title="Script editor" description="Descript-style editing lives inside each project." />
      {editable.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No ready projects yet.{' '}
          <Link href="/app/clips/new" className="text-primary underline-offset-2 hover:underline">
            Create a project
          </Link>{' '}
          and wait for transcription to finish.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {editable.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/clips/${p.id}/script`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{p.title}</span>
                <span className="text-xs text-muted-foreground">Open script →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

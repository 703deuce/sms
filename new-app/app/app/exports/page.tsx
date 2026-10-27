import { Page, PageHeader } from '@/components/app/page-primitives'
import { ExportsList } from '@/app/app/clips/(drive)/exports/exports-list'
import { parseExportStatusFilter } from '@/lib/server/clips/export-rows'
import { listWorkspaceExports } from '@/lib/server/clips/renders'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exports · Clips' }

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const workspaceId = await resolveWorkspaceId()
  const filter = parseExportStatusFilter((await searchParams).status)
  const initialRows = await listWorkspaceExports(workspaceId, filter)
  return (
    <Page>
      <PageHeader title="Exports" description="Download history for rendered clips." />
      <ExportsList key={filter} initialRows={initialRows} filter={filter} />
    </Page>
  )
}

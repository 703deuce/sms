import { Suspense } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { ExportsList } from '@/app/app/clips/exports/exports-list'
import { listClipRenders } from '@/lib/server/clips/renders'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const metadata = { title: 'Exports · Clips' }

export default async function ClipsExportsPage() {
  const workspaceId = await resolveWorkspaceId()
  const initialRows = await listClipRenders(workspaceId, 'all')
  return (
    <Page>
      <PageHeader title="Exports" description="Download history for rendered clips." />
      <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-muted" />}>
        <ExportsList initialRows={initialRows} />
      </Suspense>
    </Page>
  )
}

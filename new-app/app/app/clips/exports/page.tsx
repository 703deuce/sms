import { Page, PageHeader } from '@/components/app/page-primitives'
import { ExportsList } from '@/app/app/clips/exports/exports-list'

export const metadata = { title: 'Exports · Clips' }

export default function ClipsExportsPage() {
  return (
    <Page>
      <PageHeader title="Exports" description="Download history for rendered clips." />
      <ExportsList />
    </Page>
  )
}

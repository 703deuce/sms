import { Page, PageHeader, EmptyState } from '@/components/app/page-primitives'
import { Download } from 'lucide-react'

export const metadata = { title: 'Exports · Clips' }

export default function ClipsExportsPage() {
  return (
    <Page>
      <PageHeader title="Exports" description="Download history for rendered clips." />
      <EmptyState icon={Download} title="No exports yet" description="Exports appear here after you render clips from the editor." />
    </Page>
  )
}

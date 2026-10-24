import { Page, PageHeader } from '@/components/app/page-primitives'
import { ConsentLogTable } from '@/components/mctb/consent-log-table'

export const metadata = { title: 'Consent log · Missed Call Text Back' }

export default function MctbConsentLogPage() {
  return (
    <Page>
      <PageHeader
        title="Consent log"
        description="Press-1 captures and existing-consent attestations recorded by the MCTB runtime."
      />
      <ConsentLogTable />
    </Page>
  )
}

import { Page, PageHeader } from '@/components/app/page-primitives'
import { RecoverySettings } from '@/components/mctb/recovery-settings'

export const metadata = { title: 'Recovery · Missed Call Text Back' }

export default function RecoveryPage() {
  return (
    <Page>
      <PageHeader title="Recovery settings" description="Consent prompt, message, lines and suppression rules for missed-call texts." />
      <RecoverySettings />
    </Page>
  )
}

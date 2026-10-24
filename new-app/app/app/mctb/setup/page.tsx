import { Page, PageHeader } from '@/components/app/page-primitives'
import { MctbSetupPanel } from '@/components/mctb/mctb-setup-panel'

export const metadata = { title: 'Setup · Missed Call Text Back' }

export default function MctbSetupPage() {
  return (
    <Page>
      <PageHeader
        title="MCTB setup"
        description="Phone line, consent, templates, and recovery rules — saved to your workspace configuration."
      />
      <MctbSetupPanel />
    </Page>
  )
}

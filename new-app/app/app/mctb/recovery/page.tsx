import { Page, PageHeader } from '@/components/app/page-primitives'
import { PhoneMctbSettings } from '@/components/phone/phone-mctb-settings'

export const metadata = { title: 'Recovery · Missed Call Text Back' }

export default function RecoveryPage() {
  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Recovery settings"
        description="Choose a platform recovery message, consent method, cooldowns, and which lines send missed-call texts."
      />
      <PhoneMctbSettings />
    </Page>
  )
}

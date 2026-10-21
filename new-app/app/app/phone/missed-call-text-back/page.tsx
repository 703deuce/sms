import { Page, PageHeader } from '@/components/app/page-primitives'
import { PhoneMctbSettings } from '@/components/phone/phone-mctb-settings'

export default function PhoneMissedCallTextBackPage() {
  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Missed Call Text Back"
        description="After a missed call on your Transovo Phone number, send a compliant recovery text from the platform sender."
      />
      <PhoneMctbSettings />
    </Page>
  )
}

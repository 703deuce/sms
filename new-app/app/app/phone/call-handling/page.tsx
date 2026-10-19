import { Page, PageHeader } from '@/components/app/page-primitives'
import { TransferTargetsPanel } from '@/components/phone/transfer-targets-panel'
import { RoutingSummary } from '@/components/app/routing-summary'
import { BusinessHoursEditor } from '@/components/routing/business-hours-editor'
import { PhoneRoutingEditor } from '@/components/routing/phone-routing-editor'

export const metadata = { title: 'Call Handling · Phone' }

export default function PhoneCallHandling() {
  return (
    <Page>
      <PageHeader
        title="Call handling"
        description="Routing, business hours, voicemail, external forward, and live-call transfer destinations."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PhoneRoutingEditor />
          <TransferTargetsPanel />
        </div>
        <aside className="flex flex-col gap-6">
          <RoutingSummary title="Live policy" manageHref="/app/receptionist/call-handling" manageLabel="AI coverage" />
          <BusinessHoursEditor />
        </aside>
      </div>
    </Page>
  )
}

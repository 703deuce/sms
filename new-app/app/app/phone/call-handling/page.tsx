import { Page, PageHeader } from '@/components/app/page-primitives'
import { RoutingSummary } from '@/components/app/routing-summary'
import { BusinessHours } from '@/components/routing/business-hours'
import { PhoneRoutingEditor } from '@/components/routing/phone-routing-editor'

export const metadata = { title: 'Call Handling · Phone' }

export default function PhoneCallHandling() {
  return (
    <Page>
      <PageHeader
        title="Call handling"
        description="One routing policy per number. Changes here update AI Receptionist and Missed Call Text Back — they read the same policy."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PhoneRoutingEditor />
        </div>
        <aside className="flex flex-col gap-6">
          <RoutingSummary title="Live policy" manageHref="/app/receptionist/call-handling" manageLabel="AI coverage" />
          <BusinessHours />
        </aside>
      </div>
    </Page>
  )
}

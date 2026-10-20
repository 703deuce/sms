import { Page, PageHeader } from '@/components/app/page-primitives'
import { PhoneBusinessHoursWorkspace } from '@/components/phone/phone-business-hours-workspace'
import { Clock3 } from 'lucide-react'

export const metadata = { title: 'Business Hours · Phone' }

export default function PhoneBusinessHoursPage() {
  return (
    <Page>
      <PageHeader
        title="Business Hours"
        description="Choose how calls are handled when you're open, closed, or on holiday."
        eyebrow={
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Clock3 className="size-4" aria-hidden />
            Phone
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PhoneBusinessHoursWorkspace />
        </div>
      </div>
    </Page>
  )
}

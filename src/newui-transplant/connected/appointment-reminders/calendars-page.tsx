'use client'

import { Link2 } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { FeatureEmphasisStrip, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { CalendarIntegrationsOpus } from '@/newui-transplant/connected/integrations/calendar-integrations-opus'

export function AppointmentRemindersCalendarsPage() {
  return (
    <ArOpusPage>
      <PageHeader
        title="Calendars"
        meta={<Pill tone="info">Import for SMS</Pill>}
        description="Connect Microsoft 365 or Outlook, choose which calendars hold customer appointments, and enable automatic import for SMS reminders."
      />

      <div className="mb-6">
        <FeatureEmphasisStrip
          icon={Link2}
          title="Connect once, remind automatically"
          badge={
            <Pill tone="primary" dot={false}>
              Not scheduling
            </Pill>
          }
          description="This product imports existing calendar events and sends SMS reminders. It does not manage your booking availability or replace Acuity-style scheduling."
        />
      </div>

      <CalendarIntegrationsOpus returnPath={AR_ROUTES.calendars} variant="appointment_reminders" />
    </ArOpusPage>
  )
}

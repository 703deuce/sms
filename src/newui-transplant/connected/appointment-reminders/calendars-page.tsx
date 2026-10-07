'use client'

import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { Page, PageHeader } from '@/newui-transplant/components/app/kit'
import { CalendarIntegrationsOpus } from '@/newui-transplant/connected/integrations/calendar-integrations-opus'

export function AppointmentRemindersCalendarsPage() {
  return (
    <Page className="max-w-[1440px]">
      <PageHeader
        title="Calendars"
        description="Connect Google Calendar or Microsoft 365 and select calendars to import appointments."
      />

      <CalendarIntegrationsOpus returnPath={AR_ROUTES.calendars} variant="appointment_reminders" />
    </Page>
  )
}

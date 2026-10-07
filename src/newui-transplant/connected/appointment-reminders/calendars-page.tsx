'use client'

import { Page, PageHeader } from '@/newui-transplant/components/app/kit'
import { CalendarIntegrationsOpus } from '@/newui-transplant/connected/integrations/calendar-integrations-opus'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'

export function AppointmentRemindersCalendarsPage() {
  return (
    <Page>
      <PageHeader
        title="Calendars"
        description="Connect Google Calendar or Microsoft 365. Choose which calendars import appointments for reminders."
      />
      <CalendarIntegrationsOpus returnPath={AR_ROUTES.calendars} variant="appointment_reminders" />
    </Page>
  )
}

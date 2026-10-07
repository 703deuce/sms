'use client'

import { Suspense } from 'react'
import { Page, PageHeader } from '@/newui-transplant/components/app/kit'
import { AppointmentRemindersBookingOpus } from '@/newui-transplant/connected/appointment-reminders/booking-page-opus'

export function AppointmentRemindersBookingPage() {
  return (
    <Page className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Booking"
        description="Turn on your customer link and control branding. Create bookable offerings under Booking → Services or Meetings in the sidebar."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading booking…</p>}>
        <AppointmentRemindersBookingOpus />
      </Suspense>
    </Page>
  )
}

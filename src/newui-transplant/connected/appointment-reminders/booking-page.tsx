'use client'

import { Suspense } from 'react'
import { Page, PageHeader } from '@/newui-transplant/components/app/kit'
import { AppointmentRemindersBookingOpus } from '@/newui-transplant/connected/appointment-reminders/booking-page-opus'

export function AppointmentRemindersBookingPage() {
  return (
    <Page className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Booking"
        description="Share your customer-facing booking link and control how your public page looks — simple meetings and services with optional payment at checkout."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading booking…</p>}>
        <AppointmentRemindersBookingOpus />
      </Suspense>
    </Page>
  )
}

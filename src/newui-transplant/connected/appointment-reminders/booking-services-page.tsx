'use client'

import Link from 'next/link'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { AR_BOOKING_SERVICES_ROUTES } from '@/lib/appointments/bookable-workspace-routes'
import { ServicesWorkspaceConnected } from '@/components/appointments/services/services-workspace-connected'
import { Page, PageHeader, Pill } from '@/newui-transplant/components/app/kit'

export function AppointmentRemindersBookingServicesPage() {
  return (
    <Page className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Services"
        meta={<Pill tone="neutral" dot={false}>Creates bookable types</Pill>}
        description={
          <>
            Define what customers can book on your public page — duration, staff, price, and availability.
            Then turn the link on under{' '}
            <Link href={AR_ROUTES.booking} className="font-medium text-primary underline-offset-2 hover:underline">
              Booking page
            </Link>
            .
          </>
        }
      />
      <ServicesWorkspaceConnected serviceId={null} routes={AR_BOOKING_SERVICES_ROUTES} />
    </Page>
  )
}

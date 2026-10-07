'use client'

import Link from 'next/link'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { AR_BOOKING_MEETINGS_ROUTES } from '@/lib/appointments/bookable-workspace-routes'
import { MeetingsWorkspaceConnected } from '@/components/appointments/meetings/meetings-workspace-connected'
import { Page, PageHeader, Pill } from '@/newui-transplant/components/app/kit'

export function AppointmentRemindersBookingMeetingsPage() {
  return (
    <Page className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Meetings"
        meta={<Pill tone="neutral" dot={false}>Creates bookable types</Pill>}
        description={
          <>
            One-to-one or team meetings customers schedule themselves. Appears on your booking link when enabled.
            Manage the customer link under{' '}
            <Link href={AR_ROUTES.booking} className="font-medium text-primary underline-offset-2 hover:underline">
              Booking page
            </Link>
            .
          </>
        }
      />
      <MeetingsWorkspaceConnected meetingId={null} routes={AR_BOOKING_MEETINGS_ROUTES} />
    </Page>
  )
}

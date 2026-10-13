'use client'

import { AR_BOOKING_MEETINGS_ROUTES } from '@/lib/appointments/bookable-workspace-routes'
import { ArMeetingsWorkspaceOpus } from '@/newui-transplant/connected/appointment-reminders/ar-meetings-workspace-opus'

export function ArBookingMeetingsWorkspace({ meetingId }: { meetingId: string | null }) {
  return <ArMeetingsWorkspaceOpus meetingId={meetingId} routes={AR_BOOKING_MEETINGS_ROUTES} />
}

'use client'

import { MeetingsWorkspaceConnected } from '@/components/appointments/meetings/meetings-workspace-connected'
import { ServicesWorkspaceConnected } from '@/components/appointments/services/services-workspace-connected'
import { CreateMeetingWizard } from '@/components/appointments/meetings/create-meeting-wizard'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'
import {
  APPOINTMENTS_MEETINGS_ROUTES,
  APPOINTMENTS_SERVICES_ROUTES,
} from '@/lib/appointments/bookable-workspace-routes'
import { ArMeetingsWorkspaceOpus } from '@/newui-transplant/connected/appointment-reminders/ar-meetings-workspace-opus'
import { ArServicesWorkspaceOpus } from '@/newui-transplant/connected/appointment-reminders/ar-services-workspace-opus'
import { ArMeetingCreateOpus } from '@/newui-transplant/connected/appointment-reminders/ar-meeting-create-opus'

export function AppointmentsServicesListGate() {
  return (
    <SchedulingPageGate
      opus={<ArServicesWorkspaceOpus serviceId={null} routes={APPOINTMENTS_SERVICES_ROUTES} />}
      legacy={<ServicesWorkspaceConnected serviceId={null} />}
    />
  )
}

export function AppointmentsServiceDetailGate({ serviceId }: { serviceId: string }) {
  return (
    <SchedulingPageGate
      opus={<ArServicesWorkspaceOpus serviceId={serviceId} routes={APPOINTMENTS_SERVICES_ROUTES} />}
      legacy={<ServicesWorkspaceConnected serviceId={serviceId} />}
    />
  )
}

export function AppointmentsMeetingsListGate() {
  return (
    <SchedulingPageGate
      opus={<ArMeetingsWorkspaceOpus meetingId={null} routes={APPOINTMENTS_MEETINGS_ROUTES} />}
      legacy={<MeetingsWorkspaceConnected meetingId={null} />}
    />
  )
}

export function AppointmentsMeetingDetailGate({ meetingId }: { meetingId: string }) {
  return (
    <SchedulingPageGate
      opus={<ArMeetingsWorkspaceOpus meetingId={meetingId} routes={APPOINTMENTS_MEETINGS_ROUTES} />}
      legacy={<MeetingsWorkspaceConnected meetingId={meetingId} />}
    />
  )
}

export function AppointmentsMeetingCreateGate() {
  return (
    <SchedulingPageGate
      opus={<ArMeetingCreateOpus routes={APPOINTMENTS_MEETINGS_ROUTES} />}
      legacy={<CreateMeetingWizard />}
    />
  )
}

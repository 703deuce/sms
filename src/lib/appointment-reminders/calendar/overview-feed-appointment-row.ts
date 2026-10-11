import type { ArAppointmentRow } from '@/lib/appointment-reminders/appointments-page-types'
import type { AggregateReminderView } from '@/lib/appointment-reminders/aggregate-reminder-status'

export type ArOverviewFeedShape = {
  upcomingAppointments?: Array<{
    appointmentId: string
    customerName: string
    appointmentTitle: string
    startsAt: string
    nextReminder?: string
    reminderSecondary?: string
    reminderStatus?: string
    responseStatus?: string
    responseKind?: string
  }>
  customerResponses?: Array<{
    appointmentId: string
    customerName: string
    appointmentTitle: string
    startsAt: string
    responseAt: string
    customerResponse?: { label?: string; kind?: string }
  }>
  needsAttentionRows?: Array<{
    appointmentId: string
    customerName: string
    title?: string
    appointmentTitle?: string
    startsAt: string
    reason?: string
    issue?: string
  }>
  activity?: Array<{
    appointmentId: string
    customerLabel: string
    reminderLabel: string
    status: string
    at: string
  }>
}

function defaultReminder(label: string): AggregateReminderView {
  return {
    status: 'scheduled',
    label,
    secondaryLine: '',
  }
}

function defaultResponse() {
  return {
    kind: 'none' as const,
    label: 'No reply',
    detailLine: undefined,
    reasonLine: undefined,
  }
}

/** Build a minimal drawer row when the appointment is not in the current calendar fetch. */
export function appointmentRowFromOverviewFeed(
  appointmentId: string,
  feed: ArOverviewFeedShape | null | undefined,
  timezone: string,
): ArAppointmentRow | null {
  if (!feed) return null

  const upcoming = feed.upcomingAppointments?.find((r) => r.appointmentId === appointmentId)
  if (upcoming) {
    return {
      id: appointmentId,
      customerName: upcoming.customerName,
      appointmentTitle: upcoming.appointmentTitle,
      startsAt: upcoming.startsAt,
      endsAt: null,
      timezone,
      isAllDay: false,
      phone: null,
      phoneState: 'missing',
      reminder: defaultReminder(upcoming.nextReminder || 'Reminders'),
      customerResponse: defaultResponse(),
      sourceProvider: null,
      sourceCalendarLabel: null,
      connectionId: null,
      status: 'scheduled',
      sourceEventUrl: null,
    }
  }

  const attention = feed.needsAttentionRows?.find((r) => r.appointmentId === appointmentId)
  if (attention) {
    return {
      id: appointmentId,
      customerName: attention.customerName,
      appointmentTitle: attention.appointmentTitle || attention.title || 'Appointment',
      startsAt: attention.startsAt,
      endsAt: null,
      timezone,
      isAllDay: false,
      phone: null,
      phoneState: 'needs_review',
      reminder: { status: 'needs_attention', label: 'Needs attention', secondaryLine: attention.reason || attention.issue || '' },
      customerResponse: defaultResponse(),
      sourceProvider: null,
      sourceCalendarLabel: null,
      connectionId: null,
      status: 'scheduled',
      sourceEventUrl: null,
    }
  }

  const act = feed.activity?.find((r) => r.appointmentId === appointmentId)
  if (act) {
    const failed = /fail/i.test(act.status)
    return {
      id: appointmentId,
      customerName: act.customerLabel,
      appointmentTitle: act.reminderLabel,
      startsAt: act.at,
      endsAt: null,
      timezone,
      isAllDay: false,
      phone: null,
      phoneState: 'missing',
      reminder: failed
        ? { status: 'failed', label: act.status, secondaryLine: act.reminderLabel }
        : defaultReminder(act.status),
      customerResponse: defaultResponse(),
      sourceProvider: null,
      sourceCalendarLabel: null,
      connectionId: null,
      status: 'scheduled',
      sourceEventUrl: null,
    }
  }

  const reply = feed.customerResponses?.find((r) => r.appointmentId === appointmentId)
  if (reply) {
    return {
      id: appointmentId,
      customerName: reply.customerName,
      appointmentTitle: reply.appointmentTitle,
      startsAt: reply.startsAt,
      endsAt: null,
      timezone,
      isAllDay: false,
      phone: null,
      phoneState: 'missing',
      reminder: defaultReminder('Reminders'),
      customerResponse: {
        kind: (reply.customerResponse?.kind as ArAppointmentRow['customerResponse']['kind']) || 'none',
        label: reply.customerResponse?.label || 'Reply',
        detailLine: undefined,
        reasonLine: undefined,
      },
      sourceProvider: null,
      sourceCalendarLabel: null,
      connectionId: null,
      status: 'scheduled',
      sourceEventUrl: null,
    }
  }

  return null
}

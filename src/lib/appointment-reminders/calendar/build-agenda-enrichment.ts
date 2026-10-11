import type { ArOverviewFeedShape } from "./overview-feed-appointment-row";
import type { CalendarEventEnrichment } from "./calendar-event-display";

export function buildAgendaEnrichmentMap(
  feed: ArOverviewFeedShape | null | undefined,
): Map<string, CalendarEventEnrichment> {
  const map = new Map<string, CalendarEventEnrichment>();
  if (!feed) return map;

  for (const row of feed.upcomingAppointments ?? []) {
    const prev = map.get(row.appointmentId) || {};
    map.set(row.appointmentId, {
      ...prev,
      nextReminder: row.nextReminder,
      reminderSecondary: row.reminderSecondary,
      reminderStatus: row.reminderStatus,
      attentionReason: row.reminderAttentionReason,
      responseKind: row.responseKind,
      responseLabel: row.responseStatus,
    });
  }
  for (const row of feed.customerResponses ?? []) {
    const prev = map.get(row.appointmentId) || {};
    map.set(row.appointmentId, {
      ...prev,
      responseLabel: row.customerResponse?.label,
      responseKind: row.customerResponse?.kind,
    });
  }
  for (const row of feed.needsAttentionRows ?? []) {
    const prev = map.get(row.appointmentId) || {};
    map.set(row.appointmentId, {
      ...prev,
      attentionIssue: row.reason || row.issue,
    });
  }
  return map;
}

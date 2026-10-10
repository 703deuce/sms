import "server-only";

import { loadAppointmentRemindersPage } from "@/lib/appointment-reminders/load-appointments-page";
import type { ArAppointmentRow } from "@/lib/appointment-reminders/appointments-page-types";

export type ArNeedsAttentionRow = {
  appointmentId: string;
  customerName: string;
  appointmentTitle: string;
  startsAt: string;
  issue: string;
  lastActivityAt: string | null;
  lastActivityLabel: string;
};

function issueForRow(row: ArAppointmentRow): string | null {
  if (row.reminder.attentionReason === "workflow_conflict") {
    return row.reminder.secondaryLine || "Automation workflow handles reminders";
  }
  if (row.phoneState === "missing") return "Missing phone number";
  if (row.phoneState === "invalid") return "Invalid phone number";
  if (!row.contactEmail && row.phoneState !== "ok") return "Missing email and phone";
  if (row.reminder.status === "failed") return "Reminder delivery failed";
  if (row.reminder.status === "needs_attention") return row.reminder.label || "Reminder needs attention";
  const kind = row.customerResponse.kind;
  if (kind === "cancel_pending") return "Cancellation requested";
  if (kind === "reschedule_pending" || kind === "reschedule_requested") return "Reschedule requested";
  if (kind === "awaiting_reply") return "Awaiting confirmation";
  if (row.arRescheduleRequest?.status === "pending_approval") return "Reschedule pending approval";
  return null;
}

export async function loadArNeedsAttentionRows(
  workspaceId: string,
  limit = 20,
): Promise<ArNeedsAttentionRow[]> {
  const page = await loadAppointmentRemindersPage(workspaceId, {
    date: "upcoming",
    page: 1,
    pageSize: 300,
  });

  const out: ArNeedsAttentionRow[] = [];
  for (const row of page.rows) {
    const issue = issueForRow(row);
    if (!issue) continue;
    const lastActivityAt =
      row.customerResponse.at ||
      (row.arRescheduleRequest?.requestedAt as string | undefined) ||
      null;
    out.push({
      appointmentId: row.id,
      customerName: row.customerName,
      appointmentTitle: row.appointmentTitle,
      startsAt: row.startsAt,
      issue,
      lastActivityAt,
      lastActivityLabel: row.customerResponse.label || row.reminder.label,
    });
    if (out.length >= limit) break;
  }
  return out;
}

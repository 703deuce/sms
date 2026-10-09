import "server-only";

import { listAppointments } from "@/lib/appointments/appointments-service";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  resolveArCustomerResponseSummary,
  type ArCustomerResponseKind,
  type ArCustomerResponseSummary,
} from "@/lib/appointment-reminders/ar-sms-customer-outcome";
import { resolveArAppointmentContactDisplay } from "@/lib/appointment-reminders/contact-display";

const OVERVIEW_OUTCOME_KINDS = new Set<ArCustomerResponseKind>([
  "confirmed",
  "cancelled",
  "cancel_pending",
  "rescheduled",
  "reschedule_requested",
  "reschedule_pending",
]);

export type ArOverviewCustomerResponseRow = {
  appointmentId: string;
  customerName: string;
  appointmentTitle: string;
  startsAt: string;
  timezone: string | null;
  responseAt: string;
  customerResponse: ArCustomerResponseSummary;
};

/**
 * Latest SMS customer outcomes (confirm / cancel / reschedule) for AR Overview.
 */
export async function loadRecentArCustomerResponses(
  workspaceId: string,
  limit = 5,
): Promise<ArOverviewCustomerResponseRow[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - 120);

  const appointments = await listAppointments(workspaceId, {
    from: lookback,
    take: 1000,
  });

  const rows: ArOverviewCustomerResponseRow[] = [];

  for (const row of appointments) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const customerResponse = resolveArCustomerResponseSummary({
      status: row.status,
      startsAt: row.startsAt,
      timezone: row.timezone,
      metadata: meta,
    });

    if (!OVERVIEW_OUTCOME_KINDS.has(customerResponse.kind)) continue;
    const responseAt = customerResponse.at;
    if (!responseAt) continue;

    const contact = resolveArAppointmentContactDisplay(
      meta,
      row.inviteeName,
      row.inviteePhone,
      row.serviceName,
    );

    rows.push({
      appointmentId: row.id,
      customerName: contact.customerName,
      appointmentTitle: contact.appointmentTitle,
      startsAt: row.startsAt,
      timezone: row.timezone,
      responseAt,
      customerResponse,
    });
  }

  rows.sort((a, b) => new Date(b.responseAt).getTime() - new Date(a.responseAt).getTime());
  return rows.slice(0, Math.max(1, Math.min(limit, 20)));
}

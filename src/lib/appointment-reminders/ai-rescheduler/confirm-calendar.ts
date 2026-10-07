import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { providerRefFromAppointment } from "./provider-mutations";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getValidAccessToken, resolveWriteCalendarId } from "@/lib/calendar/providers";

/**
 * Reflect customer attendance confirmation without changing event time or creating a duplicate.
 * Best-effort provider annotation; Transovo status is always authoritative.
 */
export async function reflectCustomerConfirmationOnProvider(input: {
  workspaceId: string;
  appointmentId: string;
}): Promise<{ providerUpdated: boolean; message?: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { providerUpdated: false, message: "Appointment not found" };

  const meta = (row.metadata || {}) as AppointmentMetadata;
  if (meta.arCustomerConfirmedAt) {
    return { providerUpdated: false, message: "Already confirmed" };
  }

  const ref = providerRefFromAppointment(row);
  const confirmedAt = new Date().toISOString();

  await prisma.voiceAppointment.update({
    where: { id: row.id },
    data: {
      metadata: {
        ...meta,
        arCustomerConfirmedAt: confirmedAt,
        confirmationSource: meta.confirmationSource || "sms_reminder",
      } as object,
    },
  });

  if (!ref) {
    return { providerUpdated: false };
  }

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId: input.workspaceId },
  });
  if (!conn) return { providerUpdated: false };

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(conn.id, ref.provider, config);
  if (!token) return { providerUpdated: false, message: "Calendar token unavailable" };

  try {
    if (ref.provider === "google") {
      const calendarId = resolveWriteCalendarId(config);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(ref.providerEventId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            extendedProperties: {
              private: {
                transovoCustomerConfirmedAt: confirmedAt,
              },
            },
          }),
        },
      );
      if (!res.ok) {
        return { providerUpdated: false, message: `Google annotate ${res.status}` };
      }
      return { providerUpdated: true };
    }

    // Microsoft Graph has no standard "customer confirmed" field; Transovo metadata is authoritative.
    return { providerUpdated: false };
  } catch (err) {
    return {
      providerUpdated: false,
      message: err instanceof Error ? err.message : "Provider annotate failed",
    };
  }
}

import "server-only";

import { getPrisma } from "@/lib/db";
import { providerRefFromAppointment } from "./provider-mutations";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getValidAccessToken } from "@/lib/calendar/providers";

export async function assertSafeSingleOccurrenceMutation(input: {
  workspaceId: string;
  appointmentId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const meta = (row.metadata || {}) as Record<string, unknown>;
  if (meta.recurringSeriesId || meta.isRecurringSeries) {
    return {
      ok: false,
      message:
        "This is a recurring appointment. The business will need to adjust the series manually.",
    };
  }

  const ref = providerRefFromAppointment(row);
  if (!ref || ref.provider !== "microsoft") {
    return { ok: true };
  }

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId: input.workspaceId },
  });
  if (!conn) return { ok: true };

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(conn.id, "microsoft", config);
  if (!token) return { ok: true };

  try {
    const { microsoftGraphFetch, MICROSOFT_GRAPH_V1 } = await import("@/lib/calendar/providers");
    const res = await microsoftGraphFetch(
      conn.id,
      config,
      `${MICROSOFT_GRAPH_V1}/me/events/${encodeURIComponent(ref.providerEventId)}?$select=type,seriesMasterId,recurrence`,
      { method: "GET" },
    );
    if (!res.ok) return { ok: true };
    const json = (await res.json()) as { type?: string; seriesMasterId?: string; recurrence?: unknown };
    if (json.recurrence || json.seriesMasterId || json.type === "seriesMaster") {
      return {
        ok: false,
        message:
          "This is a recurring calendar event. Please contact the business to reschedule this occurrence.",
      };
    }
  } catch {
    return { ok: true };
  }

  return { ok: true };
}

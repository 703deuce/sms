import "server-only";

import { getPrisma } from "@/lib/db";
import { parseImportedExternalId } from "@/lib/calendar/external-id";
import type { CalendarConfig } from "@/lib/calendar/providers";
import {
  getValidAccessToken,
  getGoogleCalendarEvent,
  resolveWriteCalendarId,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "@/lib/calendar/providers";
import {
  executeMicrosoftCancelBooking,
  executeMicrosoftUpdateBooking,
  validateMicrosoftAppointmentBeforeMutation,
  type ExistingAppointment,
} from "@/lib/calendar/ar-microsoft-primitives";

export type ProviderAppointmentRef = {
  provider: "google" | "microsoft";
  connectionId: string;
  providerEventId: string;
  providerCalendarId?: string;
  timezone: string;
};

export function providerRefFromAppointment(row: {
  externalId: string | null;
  metadata: unknown;
  timezone: string | null;
  startsAt: Date;
  endsAt: Date;
}): ProviderAppointmentRef | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const externalId = row.externalId || "";
  const parsed = externalId ? parseImportedExternalId(externalId) : null;
  if (parsed) {
    return {
      provider: parsed.provider,
      connectionId: parsed.connectionId,
      providerEventId: parsed.eventId,
      providerCalendarId: typeof meta.calendarId === "string" ? meta.calendarId : undefined,
      timezone: String(meta.timezone || row.timezone || "America/New_York"),
    };
  }
  if (meta.source === "calendar_import" && meta.connectionId && meta.providerEventId) {
    const provider = meta.provider === "google" ? "google" : "microsoft";
    return {
      provider,
      connectionId: String(meta.connectionId),
      providerEventId: String(meta.providerEventId),
      providerCalendarId: typeof meta.calendarId === "string" ? meta.calendarId : undefined,
      timezone: String(meta.timezone || row.timezone || "America/New_York"),
    };
  }
  return null;
}

export function toExistingMicrosoftAppointment(
  row: { id: string; startsAt: Date; endsAt: Date },
  ref: ProviderAppointmentRef,
): ExistingAppointment {
  const durationMinutes = Math.max(
    1,
    Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000),
  );
  return {
    internalBookingId: row.id,
    provider: "microsoft",
    providerEventId: ref.providerEventId,
    providerCalendarId: ref.providerCalendarId || "",
    providerConnectionId: ref.connectionId,
    startUtc: row.startsAt.toISOString(),
    endUtc: row.endsAt.toISOString(),
    localStart: row.startsAt.toISOString(),
    localEnd: row.endsAt.toISOString(),
    timezone: ref.timezone,
    customerIdentity: {},
    durationMinutes,
    status: "ACTIVE",
  };
}

async function loadConnection(workspaceId: string, connectionId: string) {
  const prisma = getPrisma();
  return prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, status: { in: ["connected", "needs_reauth"] } },
  });
}

export async function patchProviderEventTimes(input: {
  workspaceId: string;
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  summary?: string;
}): Promise<{ ok: true } | { ok: false; message: string; outcomeUncertain?: boolean }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const ref = providerRefFromAppointment(row);
  if (!ref) {
    const { syncExternalCalendarOnReschedule } = await import("@/lib/calendar/external-sync");
    await syncExternalCalendarOnReschedule(input.workspaceId, row, {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      summary: input.summary || row.serviceName || undefined,
    });
    return { ok: true };
  }

  const conn = await loadConnection(input.workspaceId, ref.connectionId);
  if (!conn) return { ok: false, message: "Calendar connection unavailable" };

  const config = (conn.config || {}) as CalendarConfig;

  if (ref.provider === "microsoft") {
    const existing = toExistingMicrosoftAppointment(row, ref);
    const validation = await validateMicrosoftAppointmentBeforeMutation({
      appointment: existing,
      connectionId: ref.connectionId,
      calendarConfig: config,
    });
    if (!validation.ok) {
      return { ok: false, message: validation.message };
    }
    const driftStart = new Date(validation.startUtc).getTime();
    const driftEnd = new Date(validation.endUtc).getTime();
    const expectedStart = row.startsAt.getTime();
    const expectedEnd = row.endsAt.getTime();
    const driftToleranceMs = 90_000;
    if (
      Math.abs(driftStart - expectedStart) > driftToleranceMs ||
      Math.abs(driftEnd - expectedEnd) > driftToleranceMs
    ) {
      if (
        Math.abs(driftStart - input.startsAt.getTime()) <= driftToleranceMs &&
        Math.abs(driftEnd - input.endsAt.getTime()) <= driftToleranceMs
      ) {
        return { ok: true };
      }
      return {
        ok: false,
        message: "This appointment changed on the calendar. Please refresh and try again.",
      };
    }
    const result = await executeMicrosoftUpdateBooking(
      {
        connectionId: ref.connectionId,
        providerEventId: ref.providerEventId,
        providerCalendarId: ref.providerCalendarId || "",
        startUtc: input.startsAt.toISOString(),
        endUtc: input.endsAt.toISOString(),
        timezone: ref.timezone,
        summary: row.serviceName || "Appointment",
      },
      config,
    );
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        outcomeUncertain: result.outcomeUncertain,
      };
    }
    return { ok: true };
  }

  const token = await getValidAccessToken(conn.id, "google", config);
  if (!token) return { ok: false, message: "Google token unavailable" };
  const calendarId = resolveWriteCalendarId(config);
  try {
    const existing = await getGoogleCalendarEvent(token, calendarId, ref.providerEventId);
    if (!existing) {
      return { ok: false, message: "Calendar event was deleted or not found" };
    }
    if (existing.status === "cancelled") {
      return { ok: false, message: "Calendar event is already cancelled" };
    }
    const toleranceMs = 90_000;
    const proposedStart = input.startsAt.getTime();
    const proposedEnd = input.endsAt.getTime();
    if (
      existing.start &&
      Math.abs(existing.start.getTime() - proposedStart) <= toleranceMs &&
      existing.end &&
      Math.abs(existing.end.getTime() - proposedEnd) <= toleranceMs
    ) {
      return { ok: true };
    }
    const expectedStart = row.startsAt.getTime();
    const expectedEnd = row.endsAt.getTime();
    if (
      existing.start &&
      (Math.abs(existing.start.getTime() - expectedStart) > toleranceMs ||
        (existing.end && Math.abs(existing.end.getTime() - expectedEnd) > toleranceMs))
    ) {
      return {
        ok: false,
        message: "This appointment changed on the calendar. Please refresh and try again.",
      };
    }
    await updateGoogleEvent(token, calendarId, ref.providerEventId, {
      start: input.startsAt,
      end: input.endsAt,
      timezone: config.timezone || ref.timezone,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Google update failed",
    };
  }
}

export async function cancelProviderEvent(input: {
  workspaceId: string;
  appointmentId: string;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, message: "Appointment not found" };

  const ref = providerRefFromAppointment(row);
  if (!ref) {
    const { syncExternalCalendarOnCancel } = await import("@/lib/calendar/external-sync");
    await syncExternalCalendarOnCancel(input.workspaceId, row);
    return { ok: true };
  }

  const conn = await loadConnection(input.workspaceId, ref.connectionId);
  if (!conn) return { ok: false, message: "Calendar connection unavailable" };
  const config = (conn.config || {}) as CalendarConfig;

  if (ref.provider === "microsoft") {
    const result = await executeMicrosoftCancelBooking({
      connectionId: ref.connectionId,
      calendarConfig: config,
      request: {
        callId: `ar-sms-${input.appointmentId}`,
        cancellationAttemptId: `ar-cxl-${Date.now()}`,
        providerCalendarId: ref.providerCalendarId || "",
        providerEventId: ref.providerEventId,
      },
    });
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true };
  }

  const token = await getValidAccessToken(conn.id, "google", config);
  if (!token) return { ok: false, message: "Google token unavailable" };
  try {
    await deleteGoogleEvent(token, resolveWriteCalendarId(config), ref.providerEventId);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Google cancel failed" };
  }
}

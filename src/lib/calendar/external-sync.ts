import "server-only";

import { getPrisma } from "@/lib/db";
import {
  deleteGoogleEvent,
  deleteMicrosoftEvent,
  getValidAccessToken,
  resolveWriteCalendarId,
  updateGoogleEvent,
  updateMicrosoftEvent,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import {
  resolveProviderEventId,
  shouldSyncToNativeCalendar,
} from "@/lib/calendar/external-id";

async function syncCalendlyOnCancel(workspaceId: string, externalId: string) {
  const eventUri = externalId.replace(/^calendly:/, "");
  try {
    const { buildAdapterContext } = await import("@/lib/integrations/framework/context");
    const { cancelAppointment } = await import("@/lib/integrations/adapters/calendly-actions");
    const ctx = await buildAdapterContext(workspaceId, "calendly");
    await cancelAppointment(ctx, { eventUri, reason: "Canceled in Transovo" });
  } catch (err) {
    console.warn("[calendar] calendly cancel sync failed", eventUri, err);
  }
}

type AppointmentRow = {
  id: string;
  externalId: string | null;
  serviceName: string | null;
  startsAt: Date;
  endsAt: Date;
  metadata: unknown;
};

async function resolveConnectionForAppointment(
  workspaceId: string,
  appointment: AppointmentRow,
) {
  const prisma = getPrisma();
  const meta = (appointment.metadata || {}) as { connectionId?: string };
  if (meta.connectionId) {
    const byMeta = await prisma.voiceCalendarConnection.findFirst({
      where: { id: meta.connectionId, workspaceId, status: { in: ["connected", "needs_reauth"] } },
    });
    if (byMeta) return byMeta;
  }

  const service = appointment.serviceName
    ? await prisma.voiceService.findFirst({
        where: { workspaceId, name: appointment.serviceName },
      })
    : null;

  const calendarId = service?.calendarId;
  if (calendarId) {
    const conn = await prisma.voiceCalendarConnection.findFirst({
      where: { id: calendarId, workspaceId },
    });
    if (conn) return conn;
  }

  return prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId,
      provider: { in: ["google", "microsoft"] },
      status: { in: ["connected", "needs_reauth"] },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function markPushed(appointmentId: string, metadata: unknown) {
  const meta = { ...(metadata || {}) } as Record<string, unknown>;
  meta.lastPushedAt = new Date().toISOString();
  await getPrisma().voiceAppointment.update({
    where: { id: appointmentId },
    data: { metadata: meta as object },
  });
}

export async function syncExternalCalendarOnCancel(
  workspaceId: string,
  appointment: AppointmentRow,
): Promise<void> {
  if (!appointment.externalId) return;

  if (appointment.externalId.startsWith("calendly:")) {
    await syncCalendlyOnCancel(workspaceId, appointment.externalId);
    return;
  }

  if (!shouldSyncToNativeCalendar(appointment.externalId)) return;

  const conn = await resolveConnectionForAppointment(workspaceId, appointment);
  if (!conn || !["google", "microsoft"].includes(conn.provider)) return;

  const providerEventId = resolveProviderEventId(appointment.externalId, conn.provider);
  if (!providerEventId) return;

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(conn.id, conn.provider, config);
  if (!token) return;

  try {
    if (conn.provider === "google") {
      await deleteGoogleEvent(token, resolveWriteCalendarId(config), providerEventId);
    } else {
      await deleteMicrosoftEvent(token, providerEventId);
    }
    await markPushed(appointment.id, appointment.metadata);
  } catch (err) {
    console.warn("[calendar] external cancel sync failed", appointment.id, err);
  }
}

export async function syncExternalCalendarOnReschedule(
  workspaceId: string,
  appointment: AppointmentRow,
  next: { startsAt: Date; endsAt: Date; summary?: string },
): Promise<void> {
  if (!shouldSyncToNativeCalendar(appointment.externalId)) return;

  const conn = await resolveConnectionForAppointment(workspaceId, appointment);
  if (!conn || !["google", "microsoft"].includes(conn.provider)) return;

  const providerEventId = resolveProviderEventId(appointment.externalId, conn.provider);
  if (!providerEventId) return;

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(conn.id, conn.provider, config);
  if (!token) return;

  const timezone = config.timezone || "UTC";
  try {
    if (conn.provider === "google") {
      await updateGoogleEvent(token, resolveWriteCalendarId(config), providerEventId, {
        summary: next.summary,
        start: next.startsAt,
        end: next.endsAt,
        timezone,
      });
    } else {
      await updateMicrosoftEvent(token, providerEventId, {
        summary: next.summary,
        start: next.startsAt,
        end: next.endsAt,
        timezone,
      });
    }
    await markPushed(appointment.id, appointment.metadata);
  } catch (err) {
    console.warn("[calendar] external reschedule sync failed", appointment.id, err);
  }
}

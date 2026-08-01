import { getPrisma } from "@/lib/db";
import {
  computeFreeSlots,
  getGoogleBusy,
  getMicrosoftBusy,
  getValidAccessToken,
  hasOAuthTokens,
  insertGoogleEvent,
  insertMicrosoftEvent,
  type CalendarConfig,
} from "./providers";

type Slot = { startsAt: string; endsAt: string; staffName?: string };

async function resolveCalendarConnection(
  workspaceId: string,
  calendarId?: string,
) {
  const prisma = getPrisma();
  if (calendarId) {
    return prisma.voiceCalendarConnection.findFirst({
      where: { id: calendarId, workspaceId },
    });
  }
  // Fall back to the first OAuth-connected external calendar for the workspace.
  return prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId,
      provider: { in: ["google", "microsoft"] },
      status: "connected",
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAvailability(
  workspaceId: string,
  input: Record<string, unknown>,
): Promise<{ slots: Slot[] }> {
  const prisma = getPrisma();
  const serviceName = String(input.serviceName || input.service || "default");
  const calendarId = input.calendarId as string | undefined;
  const duration = Number(input.durationMinutes || 30);
  const days = Number(input.daysAhead || 7);

  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
  });
  const durationMinutes = service?.durationMinutes || duration;

  const cal = await resolveCalendarConnection(workspaceId, calendarId);
  if (cal && (cal.provider === "google" || cal.provider === "microsoft")) {
    const config = (cal.config || {}) as CalendarConfig;

    // Live OAuth-connected calendar: use provider free/busy.
    if (hasOAuthTokens(config)) {
      try {
        const token = await getValidAccessToken(cal.id, cal.provider, config);
        if (token) {
          const timeMin = new Date();
          const timeMax = new Date(timeMin.getTime() + days * 86_400_000);
          const busy =
            cal.provider === "google"
              ? await getGoogleBusy(token, config.calendarId || "primary", timeMin, timeMax)
              : await getMicrosoftBusy(token, timeMin, timeMax);
          return { slots: computeFreeSlots(busy, durationMinutes, days, timeMin) };
        }
      } catch (err) {
        console.warn("[calendar] availability lookup failed, falling back", cal.id, err);
      }
    }

    // Optional external webhook integration (e.g. custom scheduler).
    if (config.webhookUrl) {
      const { assertSafeWebhookUrl } = await import("../url-safety");
      const url = await assertSafeWebhookUrl(String(config.webhookUrl));
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "availability", serviceName, days }),
      });
      const json = await res.json();
      return { slots: (json.slots as Slot[]) || [] };
    }
  }

  // Internal availability: business hours 9-17, skip existing appointments
  const slots: Slot[] = [];
  const now = new Date();
  for (let d = 0; d < days; d += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    for (let hour = 9; hour < 17; hour += 1) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const conflict = await prisma.voiceAppointment.findFirst({
        where: {
          workspaceId,
          startsAt: { lte: end },
          endsAt: { gte: start },
          status: { not: "cancelled" },
        },
      });
      if (!conflict && start > now) {
        slots.push({
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
        });
      }
    }
  }
  return { slots: slots.slice(0, 20) };
}

export async function bookAppointment(
  workspaceId: string,
  input: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const startsAt = new Date(String(input.startsAt || ""));
  if (Number.isNaN(startsAt.getTime())) throw new Error("startsAt required");

  const durationMinutes = Number(input.durationMinutes || 30);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const phone = String(input.phone || "");
  const contactId = input.contactId as string | undefined;
  const callId = input.callId as string | undefined;

  const conflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      startsAt: { lte: endsAt },
      endsAt: { gte: startsAt },
      status: { not: "cancelled" },
    },
  });
  if (conflict) throw new Error("Slot no longer available");

  const serviceName = String(input.serviceName || "Appointment");
  const staffName = String(input.staffName || "") || null;
  const timezone = String(input.timezone || "America/New_York");

  // Create the event on the connected external calendar when OAuth tokens exist.
  let externalId: string | null = null;
  const calendarId = input.calendarId as string | undefined;
  const cal = await resolveCalendarConnection(workspaceId, calendarId);
  if (cal && (cal.provider === "google" || cal.provider === "microsoft")) {
    const config = (cal.config || {}) as CalendarConfig;
    if (hasOAuthTokens(config)) {
      try {
        const token = await getValidAccessToken(cal.id, cal.provider, config);
        if (token) {
          const event = {
            summary: `${serviceName}${phone ? ` — ${phone}` : ""}`,
            description: staffName ? `Staff: ${staffName}` : undefined,
            start: startsAt,
            end: endsAt,
            timezone: config.timezone || timezone,
          };
          externalId =
            cal.provider === "google"
              ? await insertGoogleEvent(token, config.calendarId || "primary", event)
              : await insertMicrosoftEvent(token, event);
        }
      } catch (err) {
        console.warn("[calendar] event insert failed", cal.id, err);
      }
    }
  }

  const appointment = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      callId,
      contactId,
      serviceName,
      staffName,
      startsAt,
      endsAt,
      timezone,
      status: "confirmed",
      externalId,
      metadata: input as object,
    },
  });

  if (callId) {
    await prisma.voiceCall.update({
      where: { id: callId },
      data: { appointmentBooked: true },
    });
  }

  try {
    const { publishAppointmentBooked } = await import("@/lib/crm/events");
    await publishAppointmentBooked({
      workspaceId,
      contactId,
      appointmentId: appointment.id,
      callId: callId || null,
      serviceName,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      timezone,
    }).catch(() => undefined);
  } catch {
    // CRM push is optional
  }

  return { ok: true, appointmentId: appointment.id, startsAt: appointment.startsAt };
}

/** The next upcoming (non-cancelled) appointment for a contact, if any. */
export async function findUpcomingAppointmentForContact(
  workspaceId: string,
  contactId: string,
) {
  return getPrisma().voiceAppointment.findFirst({
    where: {
      workspaceId,
      contactId,
      startsAt: { gte: new Date() },
      status: { notIn: ["cancelled", "canceled", "completed"] },
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function confirmAppointment(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!appt) throw new Error("Appointment not found");
  return prisma.voiceAppointment.update({
    where: { id: appt.id },
    data: { status: "confirmed" },
  });
}

export async function cancelAppointment(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!appt) throw new Error("Appointment not found");
  return prisma.voiceAppointment.update({
    where: { id: appt.id },
    data: { status: "cancelled" },
  });
}

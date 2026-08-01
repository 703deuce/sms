import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
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

type Slot = { startsAt: string; endsAt: string; staffName?: string; location?: string };

type ServiceConfig = {
  locations?: string[];
  minimumBookingNoticeMinutes?: number;
  staffIds?: string[];
  lastAssignedIndex?: number;
};

type StaffConfig = {
  locations?: string[];
  lastAssignedIndex?: number;
};

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
  return prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId,
      provider: { in: ["google", "microsoft"] },
      status: "connected",
    },
    orderBy: { createdAt: "asc" },
  });
}

function slotPassesNotice(start: Date, noticeMinutes: number, now: Date) {
  if (!noticeMinutes) return true;
  return start.getTime() >= now.getTime() + noticeMinutes * 60_000;
}

async function internalAvailabilitySlots(input: {
  workspaceId: string;
  durationMinutes: number;
  bufferMinutes: number;
  days: number;
  noticeMinutes: number;
  location?: string;
  staffName?: string;
}) {
  const prisma = getPrisma();
  const slots: Slot[] = [];
  const now = new Date();
  const bufferMs = input.bufferMinutes * 60_000;

  for (let d = 0; d < input.days; d += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    for (let hour = 9; hour < 17; hour += 1) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + input.durationMinutes * 60_000);
      if (!slotPassesNotice(start, input.noticeMinutes, now)) continue;

      const conflict = await prisma.voiceAppointment.findFirst({
        where: {
          workspaceId: input.workspaceId,
          startsAt: { lte: new Date(end.getTime() + bufferMs) },
          endsAt: { gte: new Date(start.getTime() - bufferMs) },
          status: { not: "cancelled" },
          ...(input.staffName ? { staffName: input.staffName } : {}),
        },
      });
      if (!conflict) {
        slots.push({
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          staffName: input.staffName || undefined,
          location: input.location || undefined,
        });
      }
    }
  }
  return slots.slice(0, 20);
}

async function pickStaffRoundRobin(
  workspaceId: string,
  serviceId?: string,
  staffIds?: string[],
) {
  const prisma = getPrisma();
  const staff = staffIds?.length
    ? await prisma.voiceStaffMember.findMany({
        where: { workspaceId, id: { in: staffIds } },
        orderBy: { name: "asc" },
      })
    : await prisma.voiceStaffMember.findMany({
        where: { workspaceId },
        orderBy: { name: "asc" },
        take: 20,
      });

  if (!staff.length) return null;

  let index = 0;
  if (serviceId) {
    const service = await prisma.voiceService.findFirst({
      where: { id: serviceId, workspaceId },
    });
    const svcCfg = (service?.config || {}) as ServiceConfig;
    index = ((svcCfg.lastAssignedIndex ?? -1) + 1) % staff.length;
    await prisma.voiceService.update({
      where: { id: serviceId },
      data: {
        config: { ...svcCfg, lastAssignedIndex: index } as object,
      },
    });
  } else {
    const globalCfg = (staff[0].config || {}) as StaffConfig;
    index = ((globalCfg.lastAssignedIndex ?? -1) + 1) % staff.length;
    const pickedMember = staff[index];
    await prisma.voiceStaffMember.update({
      where: { id: pickedMember.id },
      data: {
        config: {
          ...(pickedMember.config as object),
          lastAssignedIndex: index,
        } as object,
      },
    });
    return pickedMember;
  }

  return staff[index];
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
  const locationFilter = input.location ? String(input.location) : undefined;

  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
  });
  const svcCfg = (service?.config || {}) as ServiceConfig;
  const durationMinutes = service?.durationMinutes || duration;
  const bufferMinutes = service?.bufferMinutes || 0;
  const noticeMinutes = Number(svcCfg.minimumBookingNoticeMinutes || input.minimumBookingNoticeMinutes || 0);
  const locations = svcCfg.locations || [];

  if (locationFilter && locations.length && !locations.includes(locationFilter)) {
    return { slots: [] };
  }

  const cal = await resolveCalendarConnection(workspaceId, calendarId);
  if (cal && (cal.provider === "google" || cal.provider === "microsoft")) {
    const config = (cal.config || {}) as CalendarConfig;

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
          const raw = computeFreeSlots(busy, durationMinutes, days, timeMin, bufferMinutes);
          const slots = raw
            .filter((s) => slotPassesNotice(new Date(s.startsAt), noticeMinutes, timeMin))
            .map((s) => ({
              ...s,
              location: locationFilter || locations[0] || undefined,
            }));
          return { slots };
        }
      } catch (err) {
        console.warn("[calendar] availability lookup failed, falling back", cal.id, err);
      }
    }

    if (config.webhookUrl) {
      const { assertSafeWebhookUrl } = await import("../url-safety");
      const url = await assertSafeWebhookUrl(String(config.webhookUrl));
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "availability", serviceName, days, location: locationFilter }),
      });
      const json = await res.json();
      return { slots: (json.slots as Slot[]) || [] };
    }
  }

  const staffMembers = await prisma.voiceStaffMember.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    take: 5,
  });

  if (staffMembers.length) {
    const allSlots: Slot[] = [];
    for (const member of staffMembers) {
      const memberCfg = (member.config || {}) as StaffConfig;
      const memberLocations = memberCfg.locations || locations;
      if (locationFilter && memberLocations.length && !memberLocations.includes(locationFilter)) {
        continue;
      }
      const memberSlots = await internalAvailabilitySlots({
        workspaceId,
        durationMinutes,
        bufferMinutes,
        days,
        noticeMinutes,
        location: locationFilter || memberLocations[0],
        staffName: member.name,
      });
      allSlots.push(...memberSlots);
    }
    return { slots: allSlots.slice(0, 20) };
  }

  const slots = await internalAvailabilitySlots({
    workspaceId,
    durationMinutes,
    bufferMinutes,
    days,
    noticeMinutes,
    location: locationFilter || locations[0],
  });
  return { slots };
}

export async function bookAppointment(
  workspaceId: string,
  input: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const startsAt = new Date(String(input.startsAt || ""));
  if (Number.isNaN(startsAt.getTime())) throw new Error("startsAt required");

  const serviceName = String(input.serviceName || input.service || "Appointment");
  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
  });
  const svcCfg = (service?.config || {}) as ServiceConfig;
  const durationMinutes = Number(input.durationMinutes || service?.durationMinutes || 30);
  const bufferMinutes = service?.bufferMinutes || 0;
  const bufferMs = bufferMinutes * 60_000;
  const noticeMinutes = Number(svcCfg.minimumBookingNoticeMinutes || 0);
  const now = new Date();

  if (!slotPassesNotice(startsAt, noticeMinutes, now)) {
    throw new Error("Booking is too soon — minimum notice required");
  }

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const phone = input.phone ? normalizeE164(String(input.phone)) : "";
  const contactId = input.contactId as string | undefined;
  const callId = input.callId as string | undefined;
  const location = input.location ? String(input.location) : null;

  const conflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      startsAt: { lte: new Date(endsAt.getTime() + bufferMs) },
      endsAt: { gte: new Date(startsAt.getTime() - bufferMs) },
      status: { not: "cancelled" },
    },
  });
  if (conflict) throw new Error("Slot no longer available");

  let staffName = String(input.staffName || "") || null;
  if (!staffName) {
    const picked = await pickStaffRoundRobin(workspaceId, service?.id, svcCfg.staffIds);
    if (picked) staffName = picked.name;
  }

  const timezone = String(input.timezone || "America/New_York");

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
            description: [
              staffName ? `Staff: ${staffName}` : null,
              location ? `Location: ${location}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
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
      metadata: { ...input, location } as object,
    },
  });

  if (callId) {
    await prisma.voiceCall.update({
      where: { id: callId },
      data: { appointmentBooked: true },
    });
  }

  // SMS confirmation
  if (phone) {
    const when = startsAt.toLocaleString("en-US", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    });
    const smsBody = `Your ${serviceName} appointment is confirmed for ${when}${location ? ` at ${location}` : ""}${staffName ? ` with ${staffName}` : ""}.`;
    try {
      const { sendQuickSms } = await import("@/lib/sms/send-quick");
      await sendQuickSms({ workspaceId, to: phone, body: smsBody });
    } catch (err) {
      console.warn("[calendar] SMS confirmation failed", err);
    }
  }

  // Email confirmation job
  let emailTo = input.email ? String(input.email) : null;
  if (!emailTo && contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    emailTo = contact?.email || null;
  }
  if (emailTo) {
    const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
    await enqueueJob({
      jobType: "voice_send_email",
      queueName: "voice-calls",
      workspaceId,
      payload: {
        workspaceId,
        to: emailTo,
        subject: `${serviceName} appointment confirmed`,
        body: `Your appointment is confirmed for ${startsAt.toISOString()}.${location ? ` Location: ${location}.` : ""}${staffName ? ` Staff: ${staffName}.` : ""}`,
        callId,
        appointmentId: appointment.id,
        kind: "appointment_confirmation",
      },
      idempotencyKey: `appt-email-${appointment.id}`,
    });
  }

  // CRM push (optional)
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

  return {
    ok: true,
    success: true,
    appointmentId: appointment.id,
    startsAt: appointment.startsAt,
    staffName,
    location,
    message:
      "Appointment confirmed in the system. You may tell the caller their booking is confirmed.",
  };
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

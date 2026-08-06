import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  parseBookingHours,
  parseDaysAhead,
} from "@/lib/solutions/appointment-receptionist/notice-utils";
import { fieldSatisfied, normalizeBookingToolArgs } from "./booking-args";
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
import {
  addCalendarDays,
  wallTimeInZoneToUtc,
  zonedDateParts,
} from "./timezone-slots";

type Slot = { startsAt: string; endsAt: string; staffName?: string; location?: string };

type ServiceConfig = {
  locations?: string[];
  /** Singular location from wizard appointment types (normalized to locations). */
  location?: string | null;
  minimumBookingNoticeMinutes?: number;
  maxDaysAhead?: number | string | null;
  maximumBookingDaysAhead?: number | null;
  bookingHours?: string | null;
  bookingPermission?: string | null;
  requiredFields?: string[];
  staffIds?: string[];
  lastAssignedIndex?: number;
  timezone?: string | null;
  enabled?: boolean;
};

type StaffConfig = {
  locations?: string[];
  lastAssignedIndex?: number;
};

function serviceMaxDaysAhead(svcCfg: ServiceConfig): number {
  const parsed = Number(svcCfg.maximumBookingDaysAhead || 0);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return parseDaysAhead(svcCfg.maxDaysAhead ?? null);
}

function serviceLocations(svcCfg: ServiceConfig): string[] {
  if (Array.isArray(svcCfg.locations) && svcCfg.locations.length) {
    return svcCfg.locations.map(String);
  }
  if (svcCfg.location) return [String(svcCfg.location)];
  return [];
}

async function resolveCalendarConnection(
  workspaceId: string,
  calendarId?: string | null,
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

export function assertBookingPermission(svcCfg: ServiceConfig) {
  const permission = String(svcCfg.bookingPermission || "book_directly").toLowerCase();
  if (
    permission === "collect_info_only" ||
    permission === "request_only" ||
    permission === "send_booking_link" ||
    permission === "waitlist" ||
    permission === "require_deposit"
  ) {
    throw new Error(
      permission === "send_booking_link"
        ? "This service requires sending a booking link — do not book directly; collect the caller’s contact info and send or promise a scheduling link."
        : permission === "waitlist"
          ? "This service is waitlist-only — collect caller details instead of booking a time."
          : permission === "require_deposit"
            ? "This service requires a deposit before booking — collect details and have staff follow up."
            : "This service does not allow direct booking — collect caller details and create a follow-up instead.",
    );
  }
  if (permission === "suggest_then_confirm") {
    // Allow booking but caller should have confirmed — tool path still books after AI confirmation.
    return;
  }
}

export function assertRequiredFields(
  svcCfg: ServiceConfig,
  input: Record<string, unknown>,
) {
  const required = Array.isArray(svcCfg.requiredFields)
    ? svcCfg.requiredFields.map(String)
    : [];
  const normalized = normalizeBookingToolArgs(input);
  for (const field of required) {
    if (!fieldSatisfied(field, normalized)) {
      throw new Error(`Missing required booking field: ${field}`);
    }
  }
}

/** Load VoiceService config gates used by both native and Calendly booking paths. */
export async function loadServiceBookingConfig(
  workspaceId: string,
  serviceName: string,
): Promise<{
  service: { id: string; calendarId: string | null; durationMinutes: number; bufferMinutes: number } | null;
  config: ServiceConfig;
  noticeMinutes: number;
  maxDaysAhead: number;
}> {
  const prisma = getPrisma();
  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
  });
  const config = (service?.config || {}) as ServiceConfig;
  return {
    service: service
      ? {
          id: service.id,
          calendarId: service.calendarId,
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
        }
      : null,
    config,
    noticeMinutes: Number(config.minimumBookingNoticeMinutes || 0),
    maxDaysAhead: serviceMaxDaysAhead(config),
  };
}

export function assertBookingTimingGates(input: {
  startsAt: Date;
  noticeMinutes: number;
  maxDaysAhead: number;
  now?: Date;
}) {
  const now = input.now || new Date();
  if (!slotPassesNotice(input.startsAt, input.noticeMinutes, now)) {
    throw new Error("Booking is too soon — minimum notice required");
  }
  if (input.maxDaysAhead > 0) {
    const latest = new Date(now.getTime() + input.maxDaysAhead * 86_400_000);
    if (input.startsAt.getTime() > latest.getTime()) {
      throw new Error(`Booking is too far ahead — max ${input.maxDaysAhead} days`);
    }
  }
}

export function filterSlotsByNoticeAndMaxDays(
  slots: Array<{ startsAt: string; endsAt?: string }>,
  noticeMinutes: number,
  maxDaysAhead: number,
  now = new Date(),
) {
  const latest =
    maxDaysAhead > 0 ? new Date(now.getTime() + maxDaysAhead * 86_400_000) : null;
  return slots.filter((s) => {
    const start = new Date(s.startsAt);
    if (Number.isNaN(start.getTime())) return false;
    if (!slotPassesNotice(start, noticeMinutes, now)) return false;
    if (latest && start.getTime() > latest.getTime()) return false;
    return true;
  });
}

async function internalAvailabilitySlots(input: {
  workspaceId: string;
  durationMinutes: number;
  bufferMinutes: number;
  days: number;
  noticeMinutes: number;
  location?: string;
  staffName?: string;
  timezone?: string;
  bookingHours?: string | null;
}) {
  const prisma = getPrisma();
  const slots: Slot[] = [];
  const now = new Date();
  const bufferMs = input.bufferMinutes * 60_000;
  const tz = (input.timezone || "America/New_York").trim() || "America/New_York";
  const hours = parseBookingHours(input.bookingHours || undefined) || {
    startHour: 9,
    endHour: 17,
    weekdaysOnly: true,
  };
  const today = zonedDateParts(now, tz);

  for (let d = 0; d < input.days; d += 1) {
    const day = addCalendarDays(today.year, today.month, today.day, d);
    // Peek weekday via noon UTC-ish wall time
    const noon = wallTimeInZoneToUtc(tz, day.year, day.month, day.day, 12, 0);
    const weekday = zonedDateParts(noon, tz).weekday;
    if (hours.weekdaysOnly && (weekday === "sat" || weekday === "sun")) continue;

    for (let hour = hours.startHour; hour < hours.endHour; hour += 1) {
      const start = wallTimeInZoneToUtc(tz, day.year, day.month, day.day, hour, 0);
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
  const args = normalizeBookingToolArgs(input);
  const serviceName = String(args.serviceName || args.service || "Appointment");
  const duration = Number(args.durationMinutes || 30);
  const days = Number(args.daysAhead || 7);
  const locationFilter = args.location ? String(args.location) : undefined;
  const maxSlots = Math.max(1, Math.min(20, Number(args.maxSlots || 8)));

  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
  });
  const svcCfg = (service?.config || {}) as ServiceConfig;
  if (svcCfg.enabled === false) {
    return { slots: [] };
  }
  const durationMinutes = service?.durationMinutes || duration;
  const bufferMinutes = service?.bufferMinutes || 0;
  const noticeMinutes = Number(
    svcCfg.minimumBookingNoticeMinutes || args.minimumBookingNoticeMinutes || 0,
  );
  const locations = serviceLocations(svcCfg);
  const maxDaysAhead = serviceMaxDaysAhead(svcCfg);
  const effectiveDays =
    maxDaysAhead > 0 ? Math.min(Math.max(1, days), maxDaysAhead) : Math.max(1, days);
  // Mid-call voice webhooks must stay under Telnyx tool timeouts (~5–10s).
  const scanDays = Math.min(effectiveDays, 3);
  const timezone =
    String(args.timezone || svcCfg.timezone || "America/New_York").trim() ||
    "America/New_York";

  if (locationFilter && locations.length && !locations.includes(locationFilter)) {
    return { slots: [] };
  }

  const calendarId =
    (args.calendarId as string | undefined) || service?.calendarId || undefined;
  const cal = await resolveCalendarConnection(workspaceId, calendarId);
  if (cal && (cal.provider === "google" || cal.provider === "microsoft")) {
    const config = (cal.config || {}) as CalendarConfig;

    if (hasOAuthTokens(config)) {
      try {
        const token = await getValidAccessToken(cal.id, cal.provider, config);
        if (token) {
          const timeMin = new Date();
          const timeMax = new Date(timeMin.getTime() + scanDays * 86_400_000);
          const busy =
            cal.provider === "google"
              ? await getGoogleBusy(token, config.calendarId || "primary", timeMin, timeMax)
              : await getMicrosoftBusy(token, timeMin, timeMax);
          const hours = parseBookingHours(svcCfg.bookingHours || undefined);
          const raw = computeFreeSlots(
            busy,
            durationMinutes,
            scanDays,
            timeMin,
            bufferMinutes,
            {
              timezone,
              startHour: hours?.startHour,
              endHour: hours?.endHour,
              weekdaysOnly: hours?.weekdaysOnly,
            },
          );
          const slots = raw
            .filter((s) => slotPassesNotice(new Date(s.startsAt), noticeMinutes, timeMin))
            .map((s) => ({
              ...s,
              location: locationFilter || locations[0] || undefined,
            }));
          return { slots: slots.slice(0, maxSlots) };
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
        body: JSON.stringify({
          action: "availability",
          serviceName,
          days: scanDays,
          location: locationFilter,
        }),
      });
      const json = await res.json();
      const rawSlots = ((json.slots as Slot[]) || []) as Slot[];
      return {
        slots: filterSlotsByNoticeAndMaxDays(
          rawSlots,
          noticeMinutes,
          maxDaysAhead,
          new Date(),
        ).slice(0, maxSlots) as Slot[],
      };
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
        days: scanDays,
        noticeMinutes,
        location: locationFilter || memberLocations[0],
        staffName: member.name,
        timezone,
        bookingHours: svcCfg.bookingHours,
      });
      allSlots.push(...memberSlots);
      if (allSlots.length >= maxSlots) break;
    }
    return { slots: allSlots.slice(0, maxSlots) };
  }

  const slots = await internalAvailabilitySlots({
    workspaceId,
    durationMinutes,
    bufferMinutes,
    days: scanDays,
    noticeMinutes,
    location: locationFilter || locations[0],
    timezone,
    bookingHours: svcCfg.bookingHours,
  });
  return { slots: slots.slice(0, maxSlots) };
}
export async function bookAppointment(
  workspaceId: string,
  input: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const args = normalizeBookingToolArgs(input);
  const startsAt = new Date(String(args.startsAt || ""));
  if (Number.isNaN(startsAt.getTime())) throw new Error("startsAt required");

  const serviceName = String(args.serviceName || args.service || "Appointment");
  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
  });
  const svcCfg = (service?.config || {}) as ServiceConfig;
  if (svcCfg.enabled === false) {
    throw new Error("This appointment type is not currently bookable");
  }
  assertBookingPermission(svcCfg);
  assertRequiredFields(svcCfg, args);

  const durationMinutes = Number(args.durationMinutes || service?.durationMinutes || 30);
  const bufferMinutes = service?.bufferMinutes || 0;
  const bufferMs = bufferMinutes * 60_000;
  const noticeMinutes = Number(svcCfg.minimumBookingNoticeMinutes || 0);
  const now = new Date();
  const maxDaysAhead = serviceMaxDaysAhead(svcCfg);
  assertBookingTimingGates({ startsAt, noticeMinutes, maxDaysAhead, now });

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const phone = args.phone ? normalizeE164(String(args.phone)) : "";
  const contactId = args.contactId as string | undefined;
  const callId = args.callId as string | undefined;
  const location = args.location ? String(args.location) : null;

  // Idempotent retry: if this caller already holds this slot (timeout → retry),
  // return success instead of "Slot no longer available".
  const existingSame = await findExistingBookingForCaller({
    workspaceId,
    startsAt,
    serviceName,
    phone,
    contactId,
  });
  if (existingSame) {
    if (callId) {
      await prisma.voiceCall
        .update({
          where: { id: callId },
          data: { appointmentBooked: true },
        })
        .catch(() => undefined);
    }
    return {
      ok: true,
      success: true,
      alreadyBooked: true,
      appointmentId: existingSame.id,
      startsAt: existingSame.startsAt,
      staffName: existingSame.staffName,
      location:
        ((existingSame.metadata as { location?: string } | null)?.location as
          | string
          | undefined) || location,
      smsSent: false,
      message:
        "Appointment was already confirmed. You may tell the caller their booking is confirmed.",
    };
  }

  const conflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      startsAt: { lte: new Date(endsAt.getTime() + bufferMs) },
      endsAt: { gte: new Date(startsAt.getTime() - bufferMs) },
      status: { not: "cancelled" },
    },
  });
  if (conflict) {
    // Same-caller overlap (different service name string, etc.) — still idempotent.
    if (appointmentBelongsToCaller(conflict, phone, contactId)) {
      if (callId) {
        await prisma.voiceCall
          .update({
            where: { id: callId },
            data: { appointmentBooked: true },
          })
          .catch(() => undefined);
      }
      return {
        ok: true,
        success: true,
        alreadyBooked: true,
        appointmentId: conflict.id,
        startsAt: conflict.startsAt,
        staffName: conflict.staffName,
        location:
          ((conflict.metadata as { location?: string } | null)?.location as
            | string
            | undefined) || location,
        smsSent: false,
        message:
          "Appointment was already confirmed. You may tell the caller their booking is confirmed.",
      };
    }
    throw new Error("Slot no longer available");
  }

  // Re-check provider busy right before insert (availability can go stale).
  let staffName = String(args.staffName || "") || null;
  if (!staffName) {
    const picked = await pickStaffRoundRobin(workspaceId, service?.id, svcCfg.staffIds);
    if (picked) staffName = picked.name;
  }

  const timezone = String(args.timezone || svcCfg.timezone || "America/New_York");

  let externalId: string | null = null;
  const calendarId =
    (args.calendarId as string | undefined) || service?.calendarId || undefined;
  const cal = await resolveCalendarConnection(workspaceId, calendarId);
  if (cal && (cal.provider === "google" || cal.provider === "microsoft")) {
    const config = (cal.config || {}) as CalendarConfig;
    if (hasOAuthTokens(config)) {
      try {
        const token = await getValidAccessToken(cal.id, cal.provider, config);
        if (token) {
          const busy =
            cal.provider === "google"
              ? await getGoogleBusy(
                  token,
                  config.calendarId || "primary",
                  new Date(startsAt.getTime() - bufferMs),
                  new Date(endsAt.getTime() + bufferMs),
                )
              : await getMicrosoftBusy(
                  token,
                  new Date(startsAt.getTime() - bufferMs),
                  new Date(endsAt.getTime() + bufferMs),
                );
          const overlaps = busy.some((b) => {
            const bufferedStart = new Date(b.start.getTime() - bufferMs);
            const bufferedEnd = new Date(b.end.getTime() + bufferMs);
            return startsAt < bufferedEnd && endsAt > bufferedStart;
          });
          if (overlaps) throw new Error("Slot no longer available on the connected calendar");

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
        } else {
          throw new Error("Calendar access token unavailable");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/no longer available/i.test(message)) throw err;
        console.warn("[calendar] event insert failed", cal.id, message);
        throw new Error(
          `Could not create the calendar event — booking not confirmed (${message.slice(0, 120)})`,
        );
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
      metadata: { ...args, location } as object,
    },
  });

  if (callId) {
    await prisma.voiceCall.update({
      where: { id: callId },
      data: { appointmentBooked: true },
    });
  }

  // SMS confirmation — gated by agent messaging.smsConfirmations when agentId is known.
  let smsSent = false;
  const agentId = args.agentId ? String(args.agentId) : "";
  let smsEnabled = !agentId; // legacy callers without agent context keep prior behavior
  if (agentId) {
    const { loadVoiceAgentRuntimeConfigRecord } = await import("../load-agent-config");
    const cfg = await loadVoiceAgentRuntimeConfigRecord(workspaceId, agentId);
    const messaging = (cfg.messaging || {}) as Record<string, unknown>;
    if ("smsConfirmations" in messaging) {
      smsEnabled = Boolean(messaging.smsConfirmations);
    } else {
      const tools = Array.isArray(cfg.enabledBuiltinTools)
        ? (cfg.enabledBuiltinTools as string[])
        : [];
      smsEnabled = tools.includes("send_sms");
    }
  }
  if (args.skipSms === true) smsEnabled = false;

  if (phone && smsEnabled) {
    const when = startsAt.toLocaleString("en-US", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    });
    const smsBody = `Your ${serviceName} appointment is confirmed for ${when}${location ? ` at ${location}` : ""}${staffName ? ` with ${staffName}` : ""}.`;
    try {
      const { sendQuickSms } = await import("@/lib/sms/send-quick");
      await sendQuickSms({ workspaceId, to: phone, body: smsBody });
      smsSent = true;
    } catch (err) {
      console.warn("[calendar] SMS confirmation failed", err);
    }
  }

  // Email confirmation job
  let emailTo = args.email ? String(args.email) : null;
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
    smsSent,
    message:
      "Appointment confirmed in the system. You may tell the caller their booking is confirmed.",
  };
}

/** Digits-only phone for fuzzy metadata match (handles 571-477-6175 vs +1555…). */
function phoneDigits(raw: string | null | undefined): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

function appointmentBelongsToCaller(
  appt: { contactId?: string | null; metadata?: unknown },
  phone: string,
  contactId?: string,
): boolean {
  if (contactId && appt.contactId && appt.contactId === contactId) return true;
  const want = phoneDigits(phone);
  if (!want) return false;
  const meta = (appt.metadata || {}) as Record<string, unknown>;
  const candidates = [
    meta.phone,
    meta.customerPhone,
    meta.customer_phone,
    meta.inviteePhone,
  ].map((v) => phoneDigits(v == null ? "" : String(v)));
  return candidates.some((c) => c && (c === want || c.endsWith(want) || want.endsWith(c)));
}

/** Find an existing non-cancelled booking for this caller at startsAt (+ service). */
export async function findExistingBookingForCaller(input: {
  workspaceId: string;
  startsAt: Date;
  serviceName: string;
  phone?: string;
  contactId?: string;
}) {
  const prisma = getPrisma();
  const windowStart = new Date(input.startsAt.getTime() - 60_000);
  const windowEnd = new Date(input.startsAt.getTime() + 60_000);
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: input.workspaceId,
      startsAt: { gte: windowStart, lte: windowEnd },
      status: { notIn: ["cancelled", "canceled"] },
    },
    take: 30,
  });
  const serviceWant = input.serviceName.trim().toLowerCase();
  return (
    rows.find((r) => {
      if (
        serviceWant &&
        String(r.serviceName || "").trim().toLowerCase() !== serviceWant
      ) {
        return false;
      }
      return appointmentBelongsToCaller(r, input.phone || "", input.contactId);
    }) || null
  );
}

/** Upcoming appointments for a caller (by contactId and/or phone). */
export async function findAppointmentsForCaller(input: {
  workspaceId: string;
  phone?: string;
  contactId?: string;
  includePast?: boolean;
  limit?: number;
}) {
  const prisma = getPrisma();
  const limit = Math.min(10, Math.max(1, Number(input.limit) || 5));
  const phone = input.phone ? normalizeE164(String(input.phone)) : "";
  const digits = phoneDigits(phone);

  let contactId = input.contactId || "";
  if (!contactId && phone) {
    const contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
      select: { id: true },
    });
    contactId = contact?.id || "";
  }

  const upcoming = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: { notIn: ["cancelled", "canceled", "completed"] },
      ...(input.includePast ? {} : { startsAt: { gte: new Date() } }),
      ...(contactId ? { contactId } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: contactId ? limit : 40,
  });

  const matched = contactId
    ? upcoming
    : upcoming.filter((a) => appointmentBelongsToCaller(a, phone || digits, undefined));

  // Also scan recent metadata-only rows when contactId path found nothing.
  if (!matched.length && digits) {
    const recent = await prisma.voiceAppointment.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: { notIn: ["cancelled", "canceled", "completed"] },
        ...(input.includePast ? {} : { startsAt: { gte: new Date() } }),
      },
      orderBy: { startsAt: "asc" },
      take: 50,
    });
    return recent
      .filter((a) => appointmentBelongsToCaller(a, phone || digits, undefined))
      .slice(0, limit);
  }

  return matched.slice(0, limit);
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

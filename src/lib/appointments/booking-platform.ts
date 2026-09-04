import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  appointmentMergeVars,
  renderAppointmentTemplate,
} from "@/lib/appointments/appointments-service";
import {
  appendTimeline,
  loadAppointmentPlatformConfig,
  publicActionUrl,
  publicToken,
} from "@/lib/appointments/settings";
import type { AppointmentMetadata, AppointmentTypeConfig } from "@/lib/appointments/types";
import { assertSlotAvailableForBooking } from "@/lib/appointments/slot-validation";
import { withAtomicSlotBooking } from "@/lib/appointments/slot-booking";
import {
  markReminderSentInMeta,
  resetAppointmentReminders,
  suppressAppointmentReminders,
} from "@/lib/appointments/reminder-state";
import { bookAppointment, cancelAppointment } from "@/lib/voice/calendar/booking";
import { generateNativeSlots } from "@/lib/appointments/availability-engine";

export async function getAvailability(
  workspaceId: string,
  input: Record<string, unknown>,
): Promise<{ slots: Array<{ startsAt: string; endsAt: string }> }> {
  const serviceName = String(input.serviceName || input.service || "Appointment");
  const daysAhead = Number(input.daysAhead || 14);
  const timezone = input.timezone ? String(input.timezone) : undefined;
  return generateNativeSlots(workspaceId, { serviceName, daysAhead, timezone });
}

export async function listAppointmentTypes(workspaceId: string) {
  const prisma = getPrisma();
  const rows = await prisma.voiceService.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    durationMinutes: row.durationMinutes,
    bufferMinutes: row.bufferMinutes,
    calendarId: row.calendarId,
    config: (row.config || {}) as AppointmentTypeConfig,
    active: (row.config as AppointmentTypeConfig | null)?.enabled !== false,
  }));
}

export async function upsertAppointmentType(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    durationMinutes?: number;
    bufferMinutes?: number;
    calendarId?: string | null;
    config?: AppointmentTypeConfig;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    durationMinutes: Number(input.durationMinutes) || 30,
    bufferMinutes: Number(input.bufferMinutes) || 0,
    calendarId: input.calendarId || null,
    config: (input.config || {}) as object,
  };
  if (input.id) {
    return prisma.voiceService.update({
      where: { id: input.id, workspaceId },
      data,
    });
  }
  return prisma.voiceService.create({
    data: { workspaceId, ...data },
  });
}

async function resolveOrCreateContact(
  workspaceId: string,
  input: { firstName?: string; lastName?: string; phone: string; email?: string; consentSource?: string },
) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.phone);
  const existing = await prisma.contact.findFirst({
    where: { workspaceId, phone },
  });
  if (existing) {
    if (input.email && !existing.email) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: { email: input.email.trim() },
      });
    }
    return existing.id;
  }
  const created = await prisma.contact.create({
    data: {
      workspaceId,
      firstName: input.firstName?.trim() || "Guest",
      lastName: input.lastName?.trim() || "",
      phone,
      email: input.email?.trim() || null,
      status: "SUBSCRIBED",
      consentSource: input.consentSource || "appointment_booking",
      consentDate: new Date(),
    },
  });
  return created.id;
}

export async function createPlatformAppointment(
  workspaceId: string,
  input: {
    serviceId?: string;
    serviceName: string;
    startsAt: string;
    firstName?: string;
    lastName?: string;
    phone: string;
    email?: string;
    notes?: string;
    bookingAnswers?: Record<string, string>;
    smsConsent?: boolean;
    source?: "admin" | "public_booking";
    status?: string;
    skipSms?: boolean;
    staffId?: string;
    staffName?: string;
    locationId?: string;
    locationName?: string;
    attendeeCount?: number;
  },
) {
  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, displayName: true, name: true },
  });

  let serviceName = input.serviceName;
  if (input.serviceId) {
    const svc = await prisma.voiceService.findFirst({
      where: { id: input.serviceId, workspaceId },
    });
    if (!svc) throw new Error("Appointment type not found");
    serviceName = svc.name;
  }

  const contactId = await resolveOrCreateContact(workspaceId, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    consentSource: input.smsConsent ? "appointment_booking_sms" : "appointment_booking",
  });

  const confirmToken = publicToken();
  const cancelToken = publicToken();
  const rescheduleToken = publicToken();

  const result = await withAtomicSlotBooking(
    workspaceId,
    { serviceName, startsAt: input.startsAt },
    async () => {
      return bookAppointment(workspaceId, {
        serviceName,
        startsAt: input.startsAt,
        phone: input.phone,
        email: input.email,
        contactId,
        firstName: input.firstName,
        lastName: input.lastName,
        timezone: platform.timezone,
        skipSms: true,
        source: input.source || "admin",
        notes: input.notes,
      });
    },
  );

  const appointmentId = String(result.appointmentId || "");
  if (!appointmentId) throw new Error("Booking failed");

  const startsAt = new Date(String(result.startsAt || input.startsAt));
  const metadata = appendTimeline(
    resetAppointmentReminders({
      source: input.source || "admin",
      inviteeName: `${input.firstName || ""} ${input.lastName || ""}`.trim(),
      inviteeEmail: input.email,
      inviteePhone: input.phone,
      smsConsent: Boolean(input.smsConsent),
      smsConsentAt: input.smsConsent ? new Date().toISOString() : undefined,
      smsConsentVersion: input.smsConsent ? platform.consentVersion || "v1" : undefined,
      smsConsentText: input.smsConsent ? platform.consentText : undefined,
      confirmToken,
      cancelToken,
      rescheduleToken,
      notes: input.notes,
      bookingAnswers: input.bookingAnswers,
      staffId: input.staffId,
      locationId: input.locationId,
      location: input.locationName,
      attendeeCount: input.attendeeCount,
      confirmUrl: publicActionUrl("confirm", confirmToken),
      cancelUrl: publicActionUrl("cancel", cancelToken),
      rescheduleUrl: publicActionUrl("reschedule", rescheduleToken),
      reminderGeneration: 1,
      bookingAnswers: input.bookingAnswers,
    }),
    { type: "created", label: "Appointment created" },
  );

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: input.status || "awaiting_confirmation",
      staffName: input.staffName || undefined,
      metadata: metadata as object,
    },
  });

  if (!input.skipSms && input.smsConsent && platform.reminders.confirmation.enabled) {
    const body = renderAppointmentTemplate(
      platform.reminders.confirmation.template,
      appointmentMergeVars({
        firstName: input.firstName,
        businessName: workspace?.displayName || workspace?.name,
        service: serviceName,
        startsAt,
        timezone: platform.timezone,
        confirmLink: publicActionUrl("confirm", confirmToken),
        cancelLink: publicActionUrl("cancel", cancelToken),
        rescheduleLink: publicActionUrl("reschedule", rescheduleToken),
      }),
    );
    try {
      const { sendQuickSms } = await import("@/lib/sms/send-quick");
      await sendQuickSms({ workspaceId, to: input.phone, body });
      await prisma.voiceAppointment.update({
        where: { id: appointmentId },
        data: {
          metadata: markReminderSentInMeta(
            appendTimeline(metadata, {
              type: "confirmation_sent",
              label: "Booking confirmation sent",
            }) as AppointmentMetadata,
            "confirmation_sent",
          ) as object,
        },
      });
    } catch (err) {
      console.warn("[appointments] confirmation SMS failed", err);
    }
  }

  try {
    const { onAppointmentBooked } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentBooked(workspaceId, appointmentId, contactId);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on book", err);
  }

  return { appointmentId, contactId, ...result };
}

export async function updatePlatformAppointmentStatus(
  workspaceId: string,
  appointmentId: string,
  status: string,
  timeline?: { type: string; label: string; detail?: string },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  let meta = (row.metadata || {}) as AppointmentMetadata;
  if (timeline) meta = appendTimeline(meta, timeline) as AppointmentMetadata;
  const normalized = status.toLowerCase();
  if (["canceled", "cancelled", "completed", "no_show"].includes(normalized)) {
    meta = suppressAppointmentReminders(meta);
    if (normalized !== "canceled" && normalized !== "cancelled") {
      meta = appendTimeline(meta, {
        type: "reminders_suppressed",
        label: "Reminders cleared for closed appointment",
      }) as AppointmentMetadata;
    }
  }
  const updated = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { status, metadata: meta as object },
  });

  try {
    const { onAppointmentStatusChanged } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentStatusChanged(workspaceId, appointmentId, status);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on status change", err);
  }

  return updated;
}

export async function cancelPlatformAppointment(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  await cancelAppointment(workspaceId, appointmentId);
  const meta = appendTimeline(
    suppressAppointmentReminders((row.metadata || {}) as AppointmentMetadata),
    { type: "canceled", label: "Appointment canceled — pending reminders cleared" },
  ) as AppointmentMetadata;

  try {
    const { notifyWaitlistOnSlotAvailable } = await import("@/lib/appointments/waitlist");
    if (row.serviceName && row.startsAt > new Date()) {
      await notifyWaitlistOnSlotAvailable({
        workspaceId,
        serviceName: row.serviceName,
        startsAt: row.startsAt,
      });
    }
  } catch (err) {
    console.warn("[appointments] waitlist notify failed", err);
  }
  const canceled = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "canceled",
      metadata: appendTimeline(meta, {
        type: "reminders_suppressed",
        label: "Reminders canceled",
      }) as object,
    },
  });

  try {
    const { onAppointmentCanceled } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentCanceled(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on cancel", err);
  }

  return canceled;
}

export async function findAppointmentByPublicToken(token: string) {
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      OR: [
        { metadata: { path: ["confirmToken"], equals: token } },
        { metadata: { path: ["cancelToken"], equals: token } },
        { metadata: { path: ["rescheduleToken"], equals: token } },
      ],
    },
    take: 1,
  });
  return rows[0] || null;
}

export async function reschedulePlatformAppointment(
  workspaceId: string,
  appointmentId: string,
  startsAt: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  if (!row.serviceName) throw new Error("Appointment has no service type");

  await withAtomicSlotBooking(
    workspaceId,
    { serviceName: row.serviceName, startsAt, excludeAppointmentId: appointmentId },
    async () => {
      await assertSlotAvailableForBooking(workspaceId, {
        serviceName: row.serviceName!,
        startsAt,
        excludeAppointmentId: appointmentId,
      });
    },
  );

  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: row.serviceName },
  });
  const durationMinutes = service?.durationMinutes || 30;
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const baseMeta = resetAppointmentReminders((row.metadata || {}) as AppointmentMetadata);
  const metadata = appendTimeline(baseMeta, {
    type: "rescheduled",
    label: "Appointment rescheduled — reminders reset",
    detail: start.toISOString(),
  });

  const rescheduled = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      startsAt: start,
      endsAt: end,
      status: "awaiting_confirmation",
      metadata: metadata as object,
    },
  });

  try {
    const { onAppointmentRescheduled } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentRescheduled(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on reschedule", err);
  }

  return rescheduled;
}


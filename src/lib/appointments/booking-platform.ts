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
import { resolveMeetingUrlForAppointment, extractMeetingUrlFromText } from "@/lib/meeting-assistant/meeting-url";

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
  if (input.config?.payment) {
    const { validateAppointmentTypePayment } = await import("@/lib/merchant-payments/service");
    const paymentError = await validateAppointmentTypePayment(workspaceId, input.config.payment);
    if (paymentError) {
      throw new Error(paymentError);
    }
  }

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
        name: [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || undefined,
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
  const resolvedMeetingUrl =
    extractMeetingUrlFromText(input.locationName) ||
    extractMeetingUrlFromText(input.notes) ||
    undefined;
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
      locationKind: input.locationName?.toLowerCase().includes("zoom")
        ? "zoom"
        : input.locationName?.toLowerCase().includes("meet")
          ? "google_meet"
          : input.locationName?.toLowerCase().includes("teams")
            ? "microsoft_teams"
            : input.locationName?.toLowerCase().includes("webex")
              ? "webex"
              : undefined,
      attendeeCount: input.attendeeCount,
      meetingUrl: resolvedMeetingUrl,
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

  try {
    const { autoProvisionTransovoVideoForAppointment } = await import(
      "@/lib/transovo-video/workflow-triggers"
    );
    await autoProvisionTransovoVideoForAppointment(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] transovo video auto-provision failed", err);
  }

  const appointmentRow = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  const latestMeta = (appointmentRow?.metadata || metadata) as AppointmentMetadata;
  const meetingLink = latestMeta.meetingUrl || latestMeta.joinUrl || null;

  if (!input.skipSms && input.smsConsent && platform.reminders.confirmation.enabled) {
    const { shouldSkipPlatformRemindersForAppointment } = await import(
      "@/lib/appointment-workflows/platform-guard"
    );
    const skipPlatformConfirmation = await shouldSkipPlatformRemindersForAppointment(
      workspaceId,
      input.serviceId,
      serviceName,
    );

    if (!skipPlatformConfirmation) {
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
          meetingLink,
        }),
      );
      try {
        const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
        await sendAppointmentSms({ workspaceId, to: input.phone, body });
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
  }

  try {
    const { onAppointmentBooked } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentBooked(workspaceId, appointmentId, contactId);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on book", err);
  }

  try {
    const { autoEnableNotetakerForAppointment } = await import("@/lib/meeting-assistant/workflow-triggers");
    await autoEnableNotetakerForAppointment(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] notetaker auto-enable failed", err);
  }

  return {
    appointmentId,
    contactId,
    meetingLink,
    joinUrl: meetingLink,
    locationKind: latestMeta.locationKind || null,
    isTransovoVideo: latestMeta.locationKind === "transovo_video" || Boolean(latestMeta.videoMeetingId),
    ...result,
  };
}

export async function updatePlatformAppointmentStatus(
  workspaceId: string,
  appointmentId: string,
  status: string,
  timeline?: { type: string; label: string; detail?: string },
  initiatedBy: "customer" | "staff" | "system" | "api" | "workflow" = "staff",
  options?: { confirmationSource?: import("./types").ConfirmationSource },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  let meta = (row.metadata || {}) as AppointmentMetadata;
  meta = { ...meta, lastChangeInitiatedBy: initiatedBy };
  if (timeline) meta = appendTimeline(meta, timeline) as AppointmentMetadata;
  const normalized = status.toLowerCase();
  if (normalized === "confirmed" && options?.confirmationSource) {
    meta = { ...meta, confirmationSource: options.confirmationSource };
  }
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

export async function cancelPlatformAppointment(
  workspaceId: string,
  appointmentId: string,
  initiatedBy: "customer" | "staff" | "system" | "api" | "workflow" = "staff",
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  await cancelAppointment(workspaceId, appointmentId);
  const meta = appendTimeline(
    suppressAppointmentReminders({
      ...(row.metadata || {}) as AppointmentMetadata,
      lastChangeInitiatedBy: initiatedBy,
    }),
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

  try {
    const { cancelVideoMeetingForAppointment } = await import("@/lib/transovo-video/service");
    await cancelVideoMeetingForAppointment(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] video meeting cancel failed", err);
  }

  try {
    const { findMeetingForAppointment, disableNotetakerForSession } = await import(
      "@/lib/meeting-assistant/service"
    );
    const session = await findMeetingForAppointment(workspaceId, appointmentId);
    if (session && session.enabled) {
      await disableNotetakerForSession(workspaceId, session.id);
    }
  } catch (err) {
    console.warn("[appointments] notetaker cancel failed", err);
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
  initiatedBy: "customer" | "staff" | "system" | "api" | "workflow" = "staff",
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

  const baseMeta = resetAppointmentReminders({
    ...(row.metadata || {}) as AppointmentMetadata,
    lastChangeInitiatedBy: initiatedBy,
  });
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
    const { syncExternalCalendarOnReschedule } = await import("@/lib/calendar/external-sync");
    await syncExternalCalendarOnReschedule(workspaceId, row, {
      startsAt: start,
      endsAt: end,
      summary: row.serviceName || undefined,
    });
  } catch (err) {
    console.warn("[appointments] external calendar reschedule sync failed", err);
  }

  try {
    const { onAppointmentRescheduled } = await import("@/lib/appointment-workflows/triggers");
    await onAppointmentRescheduled(workspaceId, appointmentId);
  } catch (err) {
    console.warn("[appointments] workflow trigger failed on reschedule", err);
  }

  try {
    const { syncAppointmentMeetingSession } = await import("@/lib/meeting-assistant/service");
    await syncAppointmentMeetingSession({ workspaceId, appointmentId });
  } catch (err) {
    console.warn("[appointments] notetaker reschedule sync failed", err);
  }

  try {
    const { syncVideoMeetingSchedule } = await import("@/lib/transovo-video/service");
    await syncVideoMeetingSchedule({
      workspaceId,
      appointmentId,
      scheduledStartAt: start,
      scheduledEndAt: end,
    });
  } catch (err) {
    console.warn("[appointments] video meeting reschedule sync failed", err);
  }

  return rescheduled;
}


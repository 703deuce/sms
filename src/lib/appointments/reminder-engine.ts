import "server-only";

import { getPrisma } from "@/lib/db";
import {
  appointmentMergeVars,
  renderAppointmentTemplate,
} from "@/lib/appointments/appointments-service";
import {
  appendTimeline,
  loadAppointmentPlatformConfig,
  publicActionUrl,
} from "@/lib/appointments/settings";
import type { AppointmentMetadata, ReminderStepConfig } from "@/lib/appointments/types";
import type { ReminderStepExtended, PerCalendarReminderDefaults } from "@/lib/appointments/scheduling-capabilities";
import {
  markReminderSentInMeta,
  reminderTimelineType,
  wasReminderSent,
} from "@/lib/appointments/reminder-state";
import { buildIcsAttachment } from "@/lib/appointments/ics-builder";

export type ScheduledReminderPreview = {
  stepKey: string;
  label: string;
  channel: string;
  scheduledFor: string;
  status: "scheduled" | "sent" | "skipped" | "failed" | "past_due";
};

function isOffHours(date: Date, timezone: string, weeklyHours: Record<string, Array<{ open: string; close: string }>>) {
  const { dayKeyInTimezone } = require("@/lib/appointments/availability-engine-policy") as {
    dayKeyInTimezone: (iso: string, tz: string) => string;
  };
  const day = dayKeyInTimezone(date.toISOString(), timezone);
  const windows = weeklyHours[day] || [];
  if (!windows.length) return true;
  const hour = date.getUTCHours();
  return hour < 8 || hour > 20;
}

function resolveStepFireTime(
  step: ReminderStepExtended,
  startsAt: Date,
  timezone: string,
): Date {
  if (step.timeOfDay) {
    const [hh, mm] = step.timeOfDay.at.split(":").map(Number);
    const fire = new Date(startsAt);
    fire.setDate(fire.getDate() - step.timeOfDay.daysBefore);
    fire.setHours(hh || 9, mm || 0, 0, 0);
    return fire;
  }
  const mins = step.minutesBefore || 0;
  return new Date(startsAt.getTime() - mins * 60_000);
}

export function buildFutureReminderSchedule(input: {
  startsAt: string;
  timezone: string;
  steps: Array<{ key: string; step: ReminderStepExtended }>;
  metadata: AppointmentMetadata;
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>;
}): ScheduledReminderPreview[] {
  const startsAt = new Date(input.startsAt);
  const now = Date.now();
  const weekly = input.weeklyHours || {};
  return input.steps.map(({ key, step }) => {
    if (!step.enabled) {
      return { stepKey: key, label: step.label, channel: step.channel, scheduledFor: "", status: "skipped" };
    }
    const fireAt = resolveStepFireTime(step, startsAt, input.timezone);
    const timelineType = reminderTimelineType(key as "confirmation" | "reminder24h" | "reminder2h", step.minutesBefore);
    if (wasReminderSent(input.metadata, timelineType)) {
      return {
        stepKey: key,
        label: step.label,
        channel: step.channel,
        scheduledFor: fireAt.toISOString(),
        status: "sent",
      };
    }
    if (fireAt.getTime() < now) {
      return {
        stepKey: key,
        label: step.label,
        channel: step.channel,
        scheduledFor: fireAt.toISOString(),
        status: "past_due",
      };
    }
    if (step.skipWeekends) {
      const dow = fireAt.getDay();
      if (dow === 0 || dow === 6) {
        return { stepKey: key, label: step.label, channel: step.channel, scheduledFor: fireAt.toISOString(), status: "skipped" };
      }
    }
    if (step.skipOffHours && isOffHours(fireAt, input.timezone, weekly)) {
      return { stepKey: key, label: step.label, channel: step.channel, scheduledFor: fireAt.toISOString(), status: "skipped" };
    }
    return {
      stepKey: key,
      label: step.label,
      channel: step.channel,
      scheduledFor: fireAt.toISOString(),
      status: "scheduled",
    };
  });
}

export async function resolvePerCalendarReminderDefaults(
  workspaceId: string,
  connectionId?: string,
): Promise<PerCalendarReminderDefaults> {
  if (!connectionId) return {};
  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId },
  });
  if (!conn) return {};
  const cfg = (conn.config || {}) as { reminderDefaults?: PerCalendarReminderDefaults };
  return cfg.reminderDefaults || {};
}

export async function sendReminderEmailWithTracking(input: {
  workspaceId: string;
  appointmentId: string;
  to: string;
  subject: string;
  body: string;
  attachIcs?: boolean;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  serviceName: string;
  businessName: string;
  manageUrl?: string;
}) {
  const trackingId = `rem_${input.appointmentId}_${Date.now()}`;
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const openPixel = `${base}/api/appointments/reminders/track/open?id=${trackingId}`;
  const clickBase = `${base}/api/appointments/reminders/track/click?id=${trackingId}&url=`;

  const html = `
    ${input.body.replace(/\n/g, "<br/>")}
    <img src="${openPixel}" width="1" height="1" alt="" style="display:none" />
  `;

  const { sendTransactionalEmail } = await import("@/lib/email/brevo");
  const attachments = input.attachIcs
    ? [
        {
          name: "appointment.ics",
          content: Buffer.from(
            buildIcsAttachment({
              summary: input.serviceName,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              timezone: input.timezone,
              organizerName: input.businessName,
              manageUrl: input.manageUrl,
            }),
          ).toString("base64"),
        },
      ]
    : undefined;

  const result = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    htmlContent: html.replace(/\{\{confirm_link\}\}/g, clickBase + encodeURIComponent(input.body)),
    textContent: input.body,
    ...(attachments ? { attachments } : {}),
  } as Parameters<typeof sendTransactionalEmail>[0]);

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (row) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const tracking = (meta.emailTracking || {}) as Record<string, { sentAt: string; opens?: number; clicks?: number }>;
    tracking[trackingId] = { sentAt: new Date().toISOString(), opens: 0, clicks: 0 };
    await prisma.voiceAppointment.update({
      where: { id: input.appointmentId },
      data: { metadata: { ...meta, emailTracking: tracking } as object },
    });
  }

  return { ...result, trackingId };
}

export async function recordEmailOpen(trackingId: string) {
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({ take: 500, orderBy: { updatedAt: "desc" } });
  for (const row of rows) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const tracking = (meta.emailTracking || {}) as Record<string, { opens?: number }>;
    if (!tracking[trackingId]) continue;
    tracking[trackingId].opens = (tracking[trackingId].opens || 0) + 1;
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: { metadata: { ...meta, emailTracking: tracking } as object },
    });
    break;
  }
}

export async function recordEmailClick(trackingId: string) {
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({ take: 500, orderBy: { updatedAt: "desc" } });
  for (const row of rows) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const tracking = (meta.emailTracking || {}) as Record<string, { clicks?: number }>;
    if (!tracking[trackingId]) continue;
    tracking[trackingId].clicks = (tracking[trackingId].clicks || 0) + 1;
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: { metadata: { ...meta, emailTracking: tracking } as object },
    });
    break;
  }
}

export function normalizePhoneE164(phone: string, defaultCountry = "US"): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendInternationalAppointmentSms(input: {
  workspaceId: string;
  to: string;
  body: string;
  idempotencyKey?: string;
}) {
  const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
  const e164 = normalizePhoneE164(input.to);
  return sendAppointmentSms({
    workspaceId: input.workspaceId,
    to: e164,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
    omitConsumerTrackingLink: true,
  });
}

export async function stopRemindersAfterCustomerReply(
  workspaceId: string,
  appointmentId: string,
  replyBody: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;
  const meta = (row.metadata || {}) as AppointmentMetadata;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: appendTimeline(
        { ...meta, remindersSuppressed: true, stopOnReplyAt: new Date().toISOString() },
        { type: "reminders_stopped_on_reply", label: "Reminders stopped after customer reply", detail: replyBody.slice(0, 200) },
      ) as object,
    },
  });
  const { invalidateWorkflowExecutionsForAppointment } = await import("@/lib/appointment-workflows/engine");
  await invalidateWorkflowExecutionsForAppointment(workspaceId, appointmentId, "customer_replied");
}

export function buildDedicatedReminderTimeline(metadata: AppointmentMetadata) {
  const timeline = metadata.timeline || [];
  return timeline.filter(
    (e) =>
      e.type.includes("reminder") ||
      e.type.includes("confirmation") ||
      e.type.includes("workflow_") ||
      e.type.includes("voice_reminder") ||
      e.type.startsWith("ar_sms_outcome_"),
  );
}

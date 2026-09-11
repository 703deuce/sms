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
  resolveManageLinkFromMetadata,
} from "@/lib/appointments/settings";
import type { AppointmentMetadata, ReminderStepConfig } from "@/lib/appointments/types";
import {
  markReminderSentInMeta,
  reminderTimelineType,
  wasReminderSent,
} from "@/lib/appointments/reminder-state";
import {
  buildFutureReminderSchedule,
  resolvePerCalendarReminderDefaults,
  sendReminderEmailWithTracking,
  sendInternationalAppointmentSms,
} from "@/lib/appointments/reminder-engine";
import type { CoreReminderStepKey } from "@/lib/appointments/reminders/reminders-config";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";

async function resolveAppointmentCalendarConnectionId(
  workspaceId: string,
  meta: AppointmentMetadata,
): Promise<string | undefined> {
  const direct = (meta as { connectionId?: string }).connectionId;
  if (direct) return direct;

  const staffId = meta.staffId;
  if (staffId) {
    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const staff = (platform.staff || []).find((s) => s.id === staffId);
    if (staff?.calendarConnectionId) return staff.calendarConnectionId;
  }

  return undefined;
}

function resolveStepFireTime(
  step: ReminderStepConfig,
  startsAt: Date,
): Date {
  if (step.timeOfDay) {
    const [hh, mm] = step.timeOfDay.at.split(":").map(Number);
    const fire = new Date(startsAt);
    fire.setDate(fire.getDate() - (step.timeOfDay.daysBefore || 0));
    fire.setHours(hh || 9, mm || 0, 0, 0);
    return fire;
  }
  const mins = step.minutesBefore || 0;
  return new Date(startsAt.getTime() - mins * 60_000);
}

function shouldSkipStepNow(step: ReminderStepConfig, fireAt: Date, weeklyHours: Record<string, Array<{ open: string; close: string }>>, timezone: string): boolean {
  if (step.skipWeekends || step.skipClosedDays) {
    const dow = fireAt.getDay();
    if (dow === 0 || dow === 6) return true;
  }
  if (step.skipOffHours) {
    const hour = fireAt.getHours();
    if (hour < 8 || hour > 20) return true;
  }
  return false;
}

function configuredReminderSteps(config: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>) {
  const steps: Array<{
    key: string;
    timelineType: string;
    minutesBefore: number;
    immediate?: boolean;
    step: ReminderStepConfig;
  }> = [];

  if (config.reminders.confirmation.enabled) {
    steps.push({
      key: "confirmation",
      timelineType: reminderTimelineType("confirmation"),
      minutesBefore: 0,
      immediate: true,
      step: config.reminders.confirmation,
    });
  }

  for (const key of ["reminder24h", "reminder2h"] as CoreReminderStepKey[]) {
    const step = config.reminders[key];
    if (!step.enabled) continue;
    const minutesBefore = step.minutesBefore || (key === "reminder24h" ? 1440 : 120);
    steps.push({
      key,
      timelineType: reminderTimelineType(key, minutesBefore),
      minutesBefore,
      step,
    });
  }

  for (const extra of config.reminders.additionalSteps || []) {
    if (!extra.enabled) continue;
    const minutesBefore = extra.minutesBefore ?? 60;
    steps.push({
      key: extra.id,
      timelineType: reminderTimelineType(extra.id, minutesBefore),
      minutesBefore,
      step: extra,
    });
  }

  return steps;
}

function inviteePhone(meta: AppointmentMetadata, contactPhone?: string | null): string | null {
  return meta.inviteePhone || contactPhone || null;
}

function inviteeEmail(meta: AppointmentMetadata, contactEmail?: string | null): string | null {
  return meta.inviteeEmail || contactEmail || null;
}

async function sendReminderEmail(input: {
  workspaceId: string;
  appointmentId: string;
  email: string;
  subject: string;
  body: string;
  timelineType: string;
  label: string;
  metadata: AppointmentMetadata;
}) {
  const prisma = getPrisma();
  const { sendTransactionalEmail } = await import("@/lib/email/brevo");
  const result = await sendTransactionalEmail({
    to: input.email,
    subject: input.subject,
    htmlContent: `<p>${input.body.replace(/\n/g, "<br/>")}</p>`,
    textContent: input.body,
  });
  if (result.status === "failed") {
    throw new Error(result.error || "Email delivery failed");
  }
  const nextMeta = markReminderSentInMeta(
    appendTimeline(input.metadata, { type: input.timelineType, label: input.label }),
    input.timelineType,
  );
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: { metadata: nextMeta as object },
  });
}

async function sendReminderSms(input: {
  workspaceId: string;
  appointmentId: string;
  phone: string;
  body: string;
  timelineType: string;
  label: string;
  metadata: AppointmentMetadata;
}) {
  const prisma = getPrisma();
  const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
  await sendAppointmentSms({ workspaceId: input.workspaceId, to: input.phone, body: input.body });
  const nextMeta = markReminderSentInMeta(
    appendTimeline(input.metadata, { type: input.timelineType, label: input.label }),
    input.timelineType,
  );
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: { metadata: nextMeta as object },
  });
}

async function markReminderFailed(input: {
  appointmentId: string;
  metadata: AppointmentMetadata;
  timelineType: string;
  detail: string;
}) {
  const prisma = getPrisma();
  const nextMeta = appendTimeline(input.metadata, {
    type: `${input.timelineType}_failed`,
    label: "Reminder delivery failed",
    detail: input.detail,
  });
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      metadata: {
        ...nextMeta,
        reminderStatus: "failed",
      } as object,
    },
  });
}

async function trySendStep(input: {
  workspaceId: string;
  appointmentId: string;
  startsAt: Date;
  serviceName: string | null;
  timezone: string;
  step: ReminderStepConfig;
  timelineType: string;
  metadata: AppointmentMetadata;
  phone: string;
  email?: string | null;
  businessName: string;
  confirmToken?: string;
  cancelToken?: string;
  rescheduleToken?: string;
}) {
  if (!input.step.enabled) return false;
  if (wasReminderSent(input.metadata, input.timelineType)) return false;

  if (input.step.channel === "voice") {
    try {
      const { executeAppointmentVoiceReminder } = await import(
        "@/lib/appointment-voice-reminders/service"
      );
      await executeAppointmentVoiceReminder({
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        toE164: input.phone,
        templateId: input.step.voiceReminderTemplateId,
        inlineTemplate: input.step.template
          ? { humanScript: input.step.template, voicemailScript: input.step.template }
          : undefined,
      });
      const prisma = getPrisma();
      const nextMeta = markReminderSentInMeta(
        appendTimeline(input.metadata, {
          type: input.timelineType,
          label: input.step.label,
          detail: "Voice reminder",
        }),
        input.timelineType,
      );
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: { metadata: nextMeta as object },
      });
      return true;
    } catch (err) {
      await markReminderFailed({
        appointmentId: input.appointmentId,
        metadata: input.metadata,
        timelineType: input.timelineType,
        detail: err instanceof Error ? err.message : "voice send failed",
      });
      return false;
    }
  }

  if (input.step.channel === "email") {
    const email = input.email?.trim();
    if (!email) return false;

    const body = renderAppointmentTemplate(
      input.step.template,
      appointmentMergeVars({
        firstName: input.metadata.inviteeName?.split(/\s+/)[0],
        businessName: input.businessName,
        service: input.serviceName,
        startsAt: input.startsAt,
        timezone: input.timezone,
        confirmLink: input.confirmToken ? publicActionUrl("confirm", input.confirmToken) : "",
        cancelLink: input.cancelToken ? publicActionUrl("cancel", input.cancelToken) : "",
        rescheduleLink: input.rescheduleToken
          ? publicActionUrl("reschedule", input.rescheduleToken)
          : "",
        manageLink: resolveManageLinkFromMetadata(input.metadata, input.rescheduleToken),
        meetingLink: input.metadata.meetingUrl || input.metadata.joinUrl || "",
      }),
    );

    try {
      const endsAt = new Date(input.startsAt.getTime() + 30 * 60_000);
      const result = await sendReminderEmailWithTracking({
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        to: email,
        subject: `${input.step.label} — ${input.businessName}`,
        body,
        attachIcs: true,
        startsAt: input.startsAt,
        endsAt,
        timezone: input.timezone,
        serviceName: input.serviceName || "Appointment",
        businessName: input.businessName,
        manageUrl: resolveManageLinkFromMetadata(input.metadata, input.rescheduleToken),
      });
      if (result.status === "failed") {
        throw new Error(result.error || "Email delivery failed");
      }
      const prisma = getPrisma();
      const nextMeta = markReminderSentInMeta(
        appendTimeline(input.metadata, {
          type: input.timelineType,
          label: input.step.label,
          detail: result.trackingId ? `tracking:${result.trackingId}` : undefined,
        }),
        input.timelineType,
      );
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: { metadata: nextMeta as object },
      });

      const extra = input.metadata.extraRecipients || [];
      for (const recipient of extra) {
        if (!recipient.email) continue;
        await sendReminderEmailWithTracking({
          workspaceId: input.workspaceId,
          appointmentId: input.appointmentId,
          to: recipient.email,
          subject: `${input.step.label} — ${input.businessName}`,
          body,
          attachIcs: true,
          startsAt: input.startsAt,
          endsAt,
          timezone: input.timezone,
          serviceName: input.serviceName || "Appointment",
          businessName: input.businessName,
          manageUrl: resolveManageLinkFromMetadata(input.metadata, input.rescheduleToken),
        });
      }
      return true;
    } catch (err) {
      await markReminderFailed({
        appointmentId: input.appointmentId,
        metadata: input.metadata,
        timelineType: input.timelineType,
        detail: err instanceof Error ? err.message : "email send failed",
      });
      return false;
    }
  }

  if (input.step.channel !== "sms") return false;

  const body = renderAppointmentTemplate(
    input.step.template,
    appointmentMergeVars({
      firstName: input.metadata.inviteeName?.split(/\s+/)[0],
      businessName: input.businessName,
      service: input.serviceName,
      startsAt: input.startsAt,
      timezone: input.timezone,
      confirmLink: input.confirmToken ? publicActionUrl("confirm", input.confirmToken) : "",
      cancelLink: input.cancelToken ? publicActionUrl("cancel", input.cancelToken) : "",
      rescheduleLink: input.rescheduleToken
        ? publicActionUrl("reschedule", input.rescheduleToken)
        : "",
      manageLink: resolveManageLinkFromMetadata(input.metadata, input.rescheduleToken),
      meetingLink: input.metadata.meetingUrl || input.metadata.joinUrl || "",
    }),
  );

  try {
    await sendInternationalAppointmentSms({
      workspaceId: input.workspaceId,
      to: input.phone,
      body,
    });
    const prisma = getPrisma();
    const nextMeta = markReminderSentInMeta(
      appendTimeline(input.metadata, {
        type: input.timelineType,
        label: input.step.label,
      }),
      input.timelineType,
    );
    await prisma.voiceAppointment.update({
      where: { id: input.appointmentId },
      data: { metadata: nextMeta as object },
    });
    return true;
  } catch (err) {
    await markReminderFailed({
      appointmentId: input.appointmentId,
      metadata: input.metadata,
      timelineType: input.timelineType,
      detail: err instanceof Error ? err.message : "send failed",
    });
    return false;
  }
}

/** Scan platform appointments and send configured reminder SMS using workspace settings. */
export async function scanPlatformAppointmentReminders() {
  const prisma = getPrisma();
  const now = Date.now();
  let sent = 0;
  const windowMs = 4 * 60_000;

  const rows = await prisma.voiceAppointment.findMany({
    where: {
      startsAt: { gt: new Date(now - windowMs) },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
    take: 500,
    orderBy: { startsAt: "asc" },
  });

  for (const row of rows) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    if (meta.remindersSuppressed || meta.reminderOverride?.suppressed) continue;
    if (meta.smsConsent === false) continue;

    const { shouldSkipPlatformRemindersForAppointment } = await import(
      "@/lib/appointment-workflows/platform-guard"
    );
    const service = row.serviceName
      ? await prisma.voiceService.findFirst({
          where: { workspaceId: row.workspaceId, name: row.serviceName },
          select: { id: true },
        })
      : null;
    if (
      await shouldSkipPlatformRemindersForAppointment(
        row.workspaceId,
        service?.id,
        row.serviceName,
      )
    ) {
      continue;
    }

    const config = await loadAppointmentPlatformConfig(row.workspaceId);
    const steps = configuredReminderSteps(config).filter((s) => !s.immediate);
    const weeklyHours = resolveWeeklyHours(config);

    for (const scheduled of steps) {
      if (wasReminderSent(meta, scheduled.timelineType)) continue;

      const fireAt = resolveStepFireTime(scheduled.step, row.startsAt);
      const fireMs = fireAt.getTime();

      if (fireMs < now - windowMs) {
        if (!wasReminderSent(meta, scheduled.timelineType)) {
          await markPastDueSkipped({
            appointmentId: row.id,
            metadata: meta,
            timelineType: scheduled.timelineType,
          });
        }
        continue;
      }
      if (now < fireMs - windowMs || now > fireMs + windowMs) continue;
      if (shouldSkipStepNow(scheduled.step, fireAt, weeklyHours, row.timezone || config.timezone)) {
        continue;
      }

      const connectionId = await resolveAppointmentCalendarConnectionId(row.workspaceId, meta);
      const calendarDefaults = await resolvePerCalendarReminderDefaults(row.workspaceId, connectionId);
      const effectiveStep = applyCalendarReminderDefaults(scheduled.step, calendarDefaults);
      if (!effectiveStep.enabled) continue;

      const workspace = await prisma.workspace.findUnique({
        where: { id: row.workspaceId },
        select: { displayName: true, name: true },
      });
      const contact = row.contactId
        ? await prisma.contact.findFirst({
            where: { id: row.contactId, workspaceId: row.workspaceId },
            select: { phone: true, email: true },
          })
        : null;
      const phone = inviteePhone(meta, contact?.phone);
      const email = inviteeEmail(meta, contact?.email);
      if (!phone && !email) continue;

      const ok = await trySendStep({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
        startsAt: row.startsAt,
        serviceName: row.serviceName,
        timezone: row.timezone || config.timezone,
        step: effectiveStep,
        timelineType: scheduled.timelineType,
        metadata: meta,
        phone: phone || "",
        email,
        businessName: workspace?.displayName || workspace?.name || "our team",
        confirmToken: meta.confirmToken,
        cancelToken: meta.cancelToken,
        rescheduleToken: meta.rescheduleToken,
      });
      if (ok) sent += 1;
    }
  }

  return { ok: true, sent };
}

export function previewReminderMessage(input: {
  step: ReminderStepConfig;
  platform: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>;
  workspaceName: string;
  serviceName?: string;
  startsAt?: Date;
  tokens?: { confirm?: string; cancel?: string; reschedule?: string };
}) {
  const startsAt = input.startsAt || new Date(Date.now() + 86400000);
  return renderAppointmentTemplate(
    input.step.template,
    appointmentMergeVars({
      firstName: "Alex",
      businessName: input.platform.businessDisplayName || input.workspaceName,
      service: input.serviceName || "Consultation",
      startsAt,
      timezone: input.platform.timezone,
      confirmLink: input.tokens?.confirm ? publicActionUrl("confirm", input.tokens.confirm) : publicActionUrl("confirm", "preview"),
      cancelLink: input.tokens?.cancel ? publicActionUrl("cancel", input.tokens.cancel) : publicActionUrl("cancel", "preview"),
      rescheduleLink: input.tokens?.reschedule
        ? publicActionUrl("reschedule", input.tokens.reschedule)
        : publicActionUrl("reschedule", "preview"),
      manageLink: publicActionUrl("reschedule", input.tokens?.reschedule || "preview"),
    }),
  );
}

export async function sendTestReminderSms(
  workspaceId: string,
  input: { stepKey: string; phone: string },
) {
  const prisma = getPrisma();
  const [platform, workspace] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { displayName: true, name: true },
    }),
  ]);
  const { resolveReminderStep } = await import("@/lib/appointments/reminders/reminders-config");
  const step = resolveReminderStep(platform, input.stepKey);
  if (!step) throw new Error("Reminder step not found");
  if (!step.enabled) throw new Error("This reminder step is disabled");
  const body = `[TEST] ${previewReminderMessage({
    step,
    platform,
    workspaceName: workspace?.displayName || workspace?.name || "Business",
  })}`;
  const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
  await sendAppointmentSms({ workspaceId, to: input.phone, body });
  return { body };
}

export function buildReminderSchedule(input: {
  startsAt: string;
  metadata: AppointmentMetadata;
  config: {
    confirmation: ReminderStepConfig;
    reminder24h: ReminderStepConfig;
    reminder2h: ReminderStepConfig;
    additionalSteps?: Array<ReminderStepConfig & { id: string }>;
  };
  timezone?: string;
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>;
}) {
  const steps = [
    { key: "confirmation", step: input.config.confirmation },
    { key: "reminder24h", step: input.config.reminder24h },
    { key: "reminder2h", step: input.config.reminder2h },
    ...(input.config.additionalSteps || []).map((s) => ({ key: s.id, step: s })),
  ];
  const preview = buildFutureReminderSchedule({
    startsAt: input.startsAt,
    timezone: input.timezone || "America/New_York",
    steps,
    metadata: input.metadata,
    weeklyHours: input.weeklyHours,
  });
  return preview.map((p) => ({
    key: p.stepKey,
    label: p.label,
    status: p.status,
    scheduledFor: p.scheduledFor || undefined,
    channel: p.channel,
  }));
}

function applyCalendarReminderDefaults(
  step: ReminderStepConfig,
  defaults: Awaited<ReturnType<typeof resolvePerCalendarReminderDefaults>>,
): ReminderStepConfig {
  const next = { ...step };
  if (defaults.emailEnabled === false && step.channel === "email") next.enabled = false;
  if (defaults.smsEnabled === false && step.channel === "sms") next.enabled = false;
  if (defaults.voiceEnabled === false && step.channel === "voice") next.enabled = false;
  return next;
}

async function markPastDueSkipped(input: {
  appointmentId: string;
  metadata: AppointmentMetadata;
  timelineType: string;
}) {
  const prisma = getPrisma();
  const nextMeta = appendTimeline(input.metadata, {
    type: `${input.timelineType}_skipped_past_due`,
    label: "Reminder skipped — fire time passed",
  });
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: { metadata: nextMeta as object },
  });
}

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
import {
  markReminderSentInMeta,
  reminderTimelineType,
  wasReminderSent,
} from "@/lib/appointments/reminder-state";

type ReminderStepKey = "confirmation" | "reminder24h" | "reminder2h";

function configuredReminderSteps(config: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>) {
  const steps: Array<{
    key: ReminderStepKey;
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

  for (const key of ["reminder24h", "reminder2h"] as ReminderStepKey[]) {
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

  return steps;
}

function inviteePhone(meta: AppointmentMetadata, contactPhone?: string | null): string | null {
  return meta.inviteePhone || contactPhone || null;
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
      meetingLink: input.metadata.meetingUrl || input.metadata.joinUrl || "",
    }),
  );

  try {
    await sendReminderSms({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      phone: input.phone,
      body,
      timelineType: input.timelineType,
      label: input.step.label,
      metadata: input.metadata,
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
    if (meta.remindersSuppressed) continue;
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

    for (const scheduled of steps) {
      if (wasReminderSent(meta, scheduled.timelineType)) continue;

      const fireAt = row.startsAt.getTime() - scheduled.minutesBefore * 60_000;
      if (now < fireAt - windowMs || now > fireAt + windowMs) continue;

      const workspace = await prisma.workspace.findUnique({
        where: { id: row.workspaceId },
        select: { displayName: true, name: true },
      });
      const contact = row.contactId
        ? await prisma.contact.findFirst({
            where: { id: row.contactId, workspaceId: row.workspaceId },
            select: { phone: true },
          })
        : null;
      const phone = inviteePhone(meta, contact?.phone);
      if (!phone) continue;

      const ok = await trySendStep({
        workspaceId: row.workspaceId,
        appointmentId: row.id,
        startsAt: row.startsAt,
        serviceName: row.serviceName,
        timezone: row.timezone || config.timezone,
        step: scheduled.step,
        timelineType: scheduled.timelineType,
        metadata: meta,
        phone,
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
    }),
  );
}

export async function sendTestReminderSms(
  workspaceId: string,
  input: { stepKey: "confirmation" | "reminder24h" | "reminder2h"; phone: string },
) {
  const prisma = getPrisma();
  const [platform, workspace] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { displayName: true, name: true },
    }),
  ]);
  const step = platform.reminders[input.stepKey];
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
  };
}) {
  const meta = input.metadata;
  const timeline = meta.timeline || [];
  const sent = (type: string) => timeline.some((e) => e.type === type);
  const failed = (type: string) => timeline.some((e) => e.type === `${type}_failed`);

  if (meta.remindersSuppressed) {
    return [
      { key: "confirmation", label: input.config.confirmation.label, status: "canceled" },
      { key: "reminder24h", label: input.config.reminder24h.label, status: "canceled" },
      { key: "reminder2h", label: input.config.reminder2h.label, status: "canceled" },
    ];
  }

  const smsAllowed = meta.smsConsent !== false;

  const statusFor = (timelineType: string, enabled: boolean) => {
    if (!enabled || !smsAllowed) return "disabled";
    if (sent(timelineType)) return "sent";
    if (failed(timelineType)) return "failed";
    if (new Date(input.startsAt).getTime() <= Date.now()) return "skipped";
    return "scheduled";
  };

  const reminder24Type = reminderTimelineType(
    "reminder24h",
    input.config.reminder24h.minutesBefore || 1440,
  );
  const reminder2Type = reminderTimelineType(
    "reminder2h",
    input.config.reminder2h.minutesBefore || 120,
  );

  return [
    {
      key: "confirmation",
      label: input.config.confirmation.label,
      status: sent(reminderTimelineType("confirmation"))
        ? "sent"
        : smsAllowed && input.config.confirmation.enabled
          ? "scheduled"
          : "disabled",
    },
    {
      key: "reminder24h",
      label: input.config.reminder24h.label,
      status: statusFor(reminder24Type, input.config.reminder24h.enabled),
    },
    {
      key: "reminder2h",
      label: input.config.reminder2h.label,
      status: statusFor(reminder2Type, input.config.reminder2h.enabled),
    },
  ];
}

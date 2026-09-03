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
  wasReminderSent,
} from "@/lib/appointments/reminder-state";

const REMINDER_WINDOWS: Array<{
  key: "reminder24h" | "reminder2h";
  timelineType: "reminder_24h_sent" | "reminder_2h_sent";
  defaultMinutes: number;
}> = [
  { key: "reminder24h", timelineType: "reminder_24h_sent", defaultMinutes: 1440 },
  { key: "reminder2h", timelineType: "reminder_2h_sent", defaultMinutes: 120 },
];

function reminderAlreadySent(meta: AppointmentMetadata, timelineType: string): boolean {
  return wasReminderSent(meta, timelineType);
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
  const { sendQuickSms } = await import("@/lib/sms/send-quick");
  await sendQuickSms({ workspaceId: input.workspaceId, to: input.phone, body: input.body });
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
  if (!input.step.enabled || input.step.channel !== "sms") return false;
  if (reminderAlreadySent(input.metadata, input.timelineType)) return false;

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

/** Scan platform appointments and send configured 24h / 2h SMS reminders. */
export async function scanPlatformAppointmentReminders() {
  const prisma = getPrisma();
  const now = Date.now();
  let sent = 0;

  for (const window of REMINDER_WINDOWS) {
    const minutes = window.defaultMinutes;
    const windowStart = new Date(now + minutes * 60_000 - 3 * 60_000);
    const windowEnd = new Date(now + minutes * 60_000 + 3 * 60_000);

    const rows = await prisma.voiceAppointment.findMany({
      where: {
        startsAt: { gte: windowStart, lte: windowEnd },
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      },
      take: 200,
    });

    for (const row of rows) {
      const meta = (row.metadata || {}) as AppointmentMetadata;
      if (meta.remindersSuppressed) continue;
      if (meta.smsConsent === false) continue;
      if (reminderAlreadySent(meta, window.timelineType)) continue;

      const config = await loadAppointmentPlatformConfig(row.workspaceId);
      const step = config.reminders[window.key];
      const minutesBefore = step.minutesBefore || window.defaultMinutes;
      const targetStart = new Date(now + minutesBefore * 60_000);
      if (Math.abs(row.startsAt.getTime() - targetStart.getTime()) > 4 * 60_000) continue;

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
        step,
        timelineType: window.timelineType,
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
  const body = previewReminderMessage({
    step,
    platform,
    workspaceName: workspace?.displayName || workspace?.name || "Business",
  });
  const { sendQuickSms } = await import("@/lib/sms/send-quick");
  await sendQuickSms({ workspaceId, to: input.phone, body });
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
  if (meta.remindersSuppressed) {
    return [
      { key: "confirmation", label: input.config.confirmation.label, status: "canceled" },
      { key: "reminder24h", label: input.config.reminder24h.label, status: "canceled" },
      { key: "reminder2h", label: input.config.reminder2h.label, status: "canceled" },
    ];
  }
  const timeline = meta.timeline || [];
  const sent = (type: string) => timeline.some((e) => e.type === type);
  const failed = (type: string) => timeline.some((e) => e.type === `${type}_failed`);

  const statusFor = (type: string, enabled: boolean) => {
    if (!enabled) return "disabled";
    if (sent(type)) return "sent";
    if (failed(type)) return "failed";
    if (new Date(input.startsAt).getTime() <= Date.now()) return "skipped";
    return "scheduled";
  };

  return [
    {
      key: "confirmation",
      label: input.config.confirmation.label,
      status: sent("confirmation_sent") ? "sent" : meta.smsConsent ? "scheduled" : "disabled",
    },
    {
      key: "reminder24h",
      label: input.config.reminder24h.label,
      status: statusFor("reminder_24h_sent", input.config.reminder24h.enabled),
    },
    {
      key: "reminder2h",
      label: input.config.reminder2h.label,
      status: statusFor("reminder_2h_sent", input.config.reminder2h.enabled),
    },
  ];
}

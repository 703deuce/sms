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
  currentReminderGeneration,
  markReminderSentInMeta,
  reminderTimelineType,
  wasReminderSent,
} from "@/lib/appointments/reminder-state";
import { reminderAppointmentMergeVars } from "@/lib/appointment-reminders/template-library/merge-context";
import {
  buildFutureReminderSchedule,
  resolvePerCalendarReminderDefaults,
  sendReminderEmailWithTracking,
  sendInternationalAppointmentSms,
} from "@/lib/appointments/reminder-engine";
import type { CoreReminderStepKey } from "@/lib/appointments/reminders/reminders-config";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import { resolveEffectiveReminderPhone } from "@/lib/appointment-reminders/effective-phone";
import { evaluateSmsReminderEligibility } from "@/lib/appointment-reminders/sms-eligibility";
import {
  finalizeReminderSmsBody,
  stripHttpUrlsFromSmsBody,
} from "@/lib/appointment-reminders/message-sanitize";
import { loadAppointmentRemindersActivation } from "@/lib/appointment-reminders/activation";
import {
  releaseArReminderSmsReservation,
  reserveArReminderSmsUnit,
} from "@/lib/appointment-reminders/ar-sms-usage";
import {
  resolvePlatformLockedReminderTemplate,
  usesPlatformAppointmentSmsSender,
} from "@/lib/appointment-reminders/platform-template-policy";

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

export function resolveStepFireTime(
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

export { shouldSkipStepNow } from "@/lib/appointment-reminders/reminder-send-time-policy";

export function configuredReminderSteps(config: Awaited<ReturnType<typeof loadAppointmentPlatformConfig>>) {
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
  return resolveEffectiveReminderPhone(meta, meta.inviteePhone, contactPhone);
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

async function markReminderAllowanceBlocked(input: {
  appointmentId: string;
  metadata: AppointmentMetadata;
  timelineType: string;
  detail: string;
}) {
  const prisma = getPrisma();
  const nextMeta = appendTimeline(input.metadata, {
    type: `${input.timelineType}_suppressed`,
    label: "Reminder blocked",
    detail: input.detail,
  });
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      metadata: {
        ...nextMeta,
        reminderStatus: "blocked",
      } as object,
    },
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

async function buildReminderSmsBodyForOutbound(input: {
  workspaceId: string;
  stepKey: string;
  step: ReminderStepConfig;
  firstName?: string;
  businessName: string;
  service: string | null;
  startsAt: Date;
  timezone: string;
  confirmToken?: string;
  cancelToken?: string;
  rescheduleToken?: string;
  metadata: AppointmentMetadata;
}): Promise<string> {
  let effectiveStep = input.step;
  const platformSender = await usesPlatformAppointmentSmsSender(input.workspaceId);
  if (platformSender) {
    effectiveStep = resolvePlatformLockedReminderTemplate(input.stepKey, input.step);
  }

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const body = renderAppointmentTemplate(
    effectiveStep.template,
    reminderAppointmentMergeVars({
      platform,
      metadata: input.metadata,
      firstName: input.firstName,
      businessName: input.businessName,
      service: input.service,
      startsAt: input.startsAt,
      timezone: input.timezone,
      confirmToken: input.confirmToken,
      cancelToken: input.cancelToken,
      rescheduleToken: input.rescheduleToken,
    }),
  );

  let smsBody = finalizeReminderSmsBody(body);
  if (platformSender) {
    smsBody = stripHttpUrlsFromSmsBody(smsBody);
  }

  const { stripEmbeddedSmsReplyInstructions } = await import(
    "@/lib/appointment-reminders/sms-reply-instructions"
  );
  smsBody = stripEmbeddedSmsReplyInstructions(smsBody);

  const { workspaceAllowsSmsCustomerResponses } = await import(
    "@/lib/appointment-reminders/commercial/ar-feature-gates"
  );
  const smsResponsesAllowed = await workspaceAllowsSmsCustomerResponses(input.workspaceId);

  const { isAiReschedulerSmsEnabled, arReplyInstructionsSuffixForAppointment } = await import(
    "@/lib/appointment-reminders/ai-rescheduler/types"
  );
  const { resolveArAiReschedulerConfigForWorkspace } = await import(
    "@/lib/appointment-reminders/commercial/ar-ai-rescheduler-plan"
  );
  const arConfig = await resolveArAiReschedulerConfigForWorkspace(input.workspaceId);
  if (smsResponsesAllowed && isAiReschedulerSmsEnabled(arConfig)) {
    const suffix = arReplyInstructionsSuffixForAppointment({
      config: arConfig,
      startsAt: input.startsAt,
    });
    if (suffix.trim()) {
      smsBody = `${smsBody.trim()}${suffix}`;
    }
  }
  return smsBody;
}

async function trySendStep(input: {
  workspaceId: string;
  appointmentId: string;
  startsAt: Date;
  serviceName: string | null;
  timezone: string;
  stepKey: string;
  step: ReminderStepConfig;
  timelineType: string;
  appointmentStatus: string;
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

  const { loadAppointmentRemindersActivation } = await import(
    "@/lib/appointment-reminders/activation"
  );
  const [platform, activation] = await Promise.all([
    loadAppointmentPlatformConfig(input.workspaceId),
    loadAppointmentRemindersActivation(input.workspaceId),
  ]);
  const appointmentRemindersActivatedAt = activation.activatedAt ?? null;
  const { shouldSkipReminderStepForConfirmation } = await import(
    "@/lib/appointment-reminders/reminder-confirmation-guard"
  );
  if (
    shouldSkipReminderStepForConfirmation({
      stepKey: input.stepKey,
      step: input.step,
      appointmentStatus: input.appointmentStatus,
      metadata: input.metadata,
      platform,
    })
  ) {
    return false;
  }

  const {
    isReminderStepDisabledForService,
    resolveRecipientNotificationPreference,
    shouldRunReminderStepForRecipient,
    resolveStepChannelForAppointment,
  } = await import("@/lib/appointment-reminders/reminder-scheduling-policy");
  if (isReminderStepDisabledForService(platform, input.stepKey, input.serviceName)) {
    return false;
  }
  const effectiveChannel = resolveStepChannelForAppointment(
    input.step,
    platform,
    input.serviceName,
  );
  const recipientPref = resolveRecipientNotificationPreference(input.metadata, platform);
  if (!shouldRunReminderStepForRecipient(effectiveChannel, recipientPref)) {
    return false;
  }

  const stepForSend = effectiveChannel === input.step.channel
    ? input.step
    : { ...input.step, channel: effectiveChannel };

  if (stepForSend.channel === "voice") {
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

  if (stepForSend.channel === "email") {
    const { evaluateEmailReminderEligibility } = await import(
      "@/lib/appointment-reminders/email-reminder-eligibility"
    );
    const emailCheck = evaluateEmailReminderEligibility({
      metadata: input.metadata,
      inviteeEmail: input.email,
      appointmentStatus: input.appointmentStatus,
    });
    if (!emailCheck.eligible) return false;
    const email = emailCheck.email?.trim();
    if (!email) return false;

    const {
      resolveAiReschedulerConfig,
      isArRemindersOnlyMode,
    } = await import("@/lib/appointment-reminders/ai-rescheduler/types");
    const arForEmail = resolveAiReschedulerConfig(platform);
    const includeEmailActions = !isArRemindersOnlyMode(arForEmail);

    const mergeVars = reminderAppointmentMergeVars({
      platform,
      metadata: input.metadata,
      firstName: input.metadata.inviteeName?.split(/\s+/)[0],
      businessName: input.businessName,
      service: input.serviceName,
      startsAt: input.startsAt,
      timezone: input.timezone,
      confirmToken: input.confirmToken,
      cancelToken: input.cancelToken,
      rescheduleToken: input.rescheduleToken,
    });

    const body = renderAppointmentTemplate(stepForSend.template, mergeVars);

    try {
      const endsAt = new Date(input.startsAt.getTime() + 30 * 60_000);
      const { stepEmailSubjectDefault } = await import("@/lib/appointment-reminders/reminder-presets");
      const subjectRendered = renderAppointmentTemplate(
        stepEmailSubjectDefault(input.step, input.businessName),
        mergeVars,
      );
      const result = await sendReminderEmailWithTracking({
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        to: email,
        subject: subjectRendered,
        body,
        attachIcs: input.step.attachIcs !== false,
        branding: platform.reminderEmailBranding,
        preparationInstructions: platform.reminderPreferences?.preparationInstructions,
        cancellationPolicyText: platform.reminderPreferences?.cancellationPolicyText,
        actionLinks: includeEmailActions
          ? {
              confirm: input.confirmToken ? publicActionUrl("confirm", input.confirmToken) : undefined,
              cancel: input.cancelToken ? publicActionUrl("cancel", input.cancelToken) : undefined,
              reschedule: input.rescheduleToken
                ? publicActionUrl("reschedule", input.rescheduleToken)
                : undefined,
            }
          : {},
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

  if (stepForSend.channel !== "sms") return false;

  const smsEligibility = evaluateSmsReminderEligibility({
    metadata: input.metadata,
    inviteePhone: input.metadata.inviteePhone,
    contactPhone: input.phone,
    appointmentStatus: input.appointmentStatus,
    platform,
    appointmentRemindersActivatedAt,
  });
  if (!smsEligibility.eligible) {
    await markReminderAllowanceBlocked({
      appointmentId: input.appointmentId,
      metadata: input.metadata,
      timelineType: input.timelineType,
      detail: smsEligibility.detail || "SMS not eligible",
    });
    return false;
  }

  let effectiveStep = input.step;
  if (await usesPlatformAppointmentSmsSender(input.workspaceId)) {
    effectiveStep = resolvePlatformLockedReminderTemplate(input.stepKey, input.step);
  }

  const smsBodyPreview = await buildReminderSmsBodyForOutbound({
    workspaceId: input.workspaceId,
    stepKey: input.stepKey,
    step: input.step,
    firstName: input.metadata.inviteeName?.split(/\s+/)[0],
    businessName: input.businessName,
    service: input.serviceName,
    startsAt: input.startsAt,
    timezone: input.timezone,
    confirmToken: input.confirmToken,
    cancelToken: input.cancelToken,
    rescheduleToken: input.rescheduleToken,
    metadata: input.metadata,
  });
  const { analyzeSmsBody } = await import("@/lib/sms/segment-encoding");
  const segmentCount = Math.max(1, analyzeSmsBody(smsBodyPreview).segmentCount);

  const reservation = await reserveArReminderSmsUnit({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    timelineType: input.timelineType,
    segments: segmentCount,
  });
  if (!reservation.reserved) {
    await markReminderAllowanceBlocked({
      appointmentId: input.appointmentId,
      metadata: input.metadata,
      timelineType: input.timelineType,
      detail:
        reservation.reason === "ar_sms_limit_reached"
          ? "Monthly Appointment Reminders SMS allowance reached"
          : "Appointment Reminders SMS allowance is not configured",
    });
    return false;
  }

  try {
    const smsBody = smsBodyPreview;
    const apptRowForContact = await getPrisma().voiceAppointment.findFirst({
      where: { id: input.appointmentId, workspaceId: input.workspaceId },
      select: { contactId: true },
    });
    const usePlatformSession =
      (await usesPlatformAppointmentSmsSender(input.workspaceId)) && apptRowForContact?.contactId;
    let outboundProviderMessageId: string | undefined;
    if (usePlatformSession) {
      const { sendArReminderSmsWithSession } = await import(
        "@/lib/appointment-reminders/messaging/outbound-reminder"
      );
      const platformSend = await sendArReminderSmsWithSession({
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        contactId: apptRowForContact.contactId!,
        phone: input.phone,
        body: smsBody,
        timelineType: input.timelineType,
      });
      if (!platformSend.sent) {
        await markReminderAllowanceBlocked({
          appointmentId: input.appointmentId,
          metadata: input.metadata,
          timelineType: input.timelineType,
          detail: platformSend.pendingSendReason || platformSend.reason,
        });
        await releaseArReminderSmsReservation({
          workspaceId: input.workspaceId,
          appointmentId: input.appointmentId,
          timelineType: input.timelineType,
          segments: segmentCount,
        });
        return false;
      }
      outboundProviderMessageId = platformSend.providerMessageId;
    } else {
      const sendResult = await sendInternationalAppointmentSms({
        workspaceId: input.workspaceId,
        to: input.phone,
        body: smsBody,
      });
      outboundProviderMessageId =
        sendResult && typeof sendResult === "object" && "messageId" in sendResult
          ? String((sendResult as { messageId?: string }).messageId || "")
          : undefined;
    }
    const prisma = getPrisma();
    if (outboundProviderMessageId) {
      await prisma.arReminderDispatch.updateMany({
        where: {
          appointmentId: input.appointmentId,
          timelineType: input.timelineType,
          reminderGeneration: currentReminderGeneration(input.metadata),
        },
        data: {
          telnyxMessageId: outboundProviderMessageId,
          providerMessageId: outboundProviderMessageId,
        },
      });
    }
    const nextMeta = markReminderSentInMeta(
      appendTimeline(input.metadata, {
        type: input.timelineType,
        label: effectiveStep.label,
      }),
      input.timelineType,
    );
    await prisma.voiceAppointment.update({
      where: { id: input.appointmentId },
      data: { metadata: nextMeta as object },
    });
    const apptRow = await prisma.voiceAppointment.findFirst({
      where: { id: input.appointmentId },
      select: { contactId: true, metadata: true },
    });
    if (apptRow?.contactId) {
      const { seedRescheduleConversationOnReminderSend } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/inbound-replies"
      );
      const gen = (apptRow.metadata as AppointmentMetadata)?.reminderGeneration;
      await seedRescheduleConversationOnReminderSend({
        workspaceId: input.workspaceId,
        contactId: apptRow.contactId,
        appointmentId: input.appointmentId,
        reminderGeneration: typeof gen === "number" ? gen : undefined,
        timelineType: input.timelineType,
        outboundProviderMessageId: outboundProviderMessageId || undefined,
      });
    }
    return true;
  } catch (err) {
    await releaseArReminderSmsReservation({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      timelineType: input.timelineType,
      segments: segmentCount,
    });
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
export async function workspaceRemindersOperational(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const activation = await loadAppointmentRemindersActivation(workspaceId);
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const { isArRemindersPaused } = await import("@/lib/appointment-reminders/ar-operational-pause");
  if (isArRemindersPaused(platform)) return false;

  if (activation.activatedAt) return true;

  const priorDispatch = await prisma.arReminderDispatch.findFirst({
    where: { workspaceId, status: { in: ["sent", "delivered", "queued", "sending"] } },
    select: { id: true },
  });
  if (priorDispatch) {
    const { evaluateAppointmentRemindersSetupReadiness } = await import(
      "@/lib/appointment-reminders/activation"
    );
    const readiness = await evaluateAppointmentRemindersSetupReadiness(workspaceId);
    return readiness.canActivate;
  }

  return false;
}

export async function scanPlatformAppointmentReminders() {
  const { discoverAndEnqueueDueAppointmentReminders } = await import(
    "@/lib/appointment-reminders/reminder-discovery"
  );
  const discovery = await discoverAndEnqueueDueAppointmentReminders();
  return { ok: true, sent: discovery.enqueued, discovery };
}

/** Send immediate confirmation once for a newly eligible future appointment (calendar import / webhook). */
export async function maybeSendImmediateConfirmationForAppointment(
  workspaceId: string,
  appointmentId: string,
  opts?: { minStartsAtMs?: number },
): Promise<{ sent: boolean; skipped?: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return { sent: false, skipped: "not_found" };

  const minStart = opts?.minStartsAtMs ?? Date.now();
  if (row.startsAt.getTime() < minStart) {
    return { sent: false, skipped: "historical_or_past_start" };
  }
  if (row.startsAt.getTime() <= Date.now()) {
    return { sent: false, skipped: "appointment_already_started" };
  }

  const meta = (row.metadata || {}) as AppointmentMetadata;
  if (meta.remindersSuppressed || meta.reminderOverride?.suppressed) {
    return { sent: false, skipped: "suppressed" };
  }
  const { isAppointmentReminderImportEligible } = await import("@/lib/calendar/import-eligibility");
  if (!isAppointmentReminderImportEligible(meta)) {
    return { sent: false, skipped: "reminder_not_eligible" };
  }
  const { shouldHoldRemindersForAppointment } = await import(
    "@/lib/appointment-reminders/ai-rescheduler/ar-reminder-guard"
  );
  if (shouldHoldRemindersForAppointment(meta)) {
    return { sent: false, skipped: "ar_reconcile_pending" };
  }

  if (!(await workspaceRemindersOperational(workspaceId))) {
    return { sent: false, skipped: "not_activated" };
  }

  const { loadAppointmentRemindersActivation } = await import(
    "@/lib/appointment-reminders/activation"
  );
  const [config, activation] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    loadAppointmentRemindersActivation(workspaceId),
  ]);
  const appointmentRemindersActivatedAt = activation.activatedAt ?? null;
  const confirmation = configuredReminderSteps(config).find((s) => s.immediate);
  if (!confirmation || !confirmation.step.enabled) {
    return { sent: false, skipped: "confirmation_disabled" };
  }
  if (wasReminderSent(meta, confirmation.timelineType)) {
    return { sent: false, skipped: "already_sent" };
  }

  const contact = row.contactId
    ? await prisma.contact.findFirst({
        where: { id: row.contactId, workspaceId },
        select: { phone: true, email: true },
      })
    : null;

  const smsEligibility = evaluateSmsReminderEligibility({
    metadata: meta,
    inviteePhone: meta.inviteePhone,
    contactPhone: contact?.phone,
    appointmentStatus: row.status,
    platform: config,
    appointmentRemindersActivatedAt,
  });
  if (confirmation.step.channel === "sms" && !smsEligibility.eligible) {
    return { sent: false, skipped: smsEligibility.blockReason };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { displayName: true, name: true },
  });
  const phone = inviteePhone(meta, contact?.phone);
  const email = inviteeEmail(meta, contact?.email);
  if (confirmation.step.channel === "sms" && !phone) {
    return { sent: false, skipped: "missing_phone" };
  }
  if (confirmation.step.channel === "email" && !email) {
    return { sent: false, skipped: "missing_email" };
  }

  const ok = await trySendStep({
    workspaceId,
    appointmentId: row.id,
    startsAt: row.startsAt,
    serviceName: row.serviceName,
    timezone: row.timezone || config.timezone,
    stepKey: confirmation.key,
    step: confirmation.step,
    timelineType: confirmation.timelineType,
    appointmentStatus: row.status,
    metadata: meta,
    phone: phone || "",
    email,
    businessName: workspace?.displayName || workspace?.name || "our team",
    confirmToken: meta.confirmToken,
    cancelToken: meta.cancelToken,
    rescheduleToken: meta.rescheduleToken,
  });
  return { sent: ok };
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
  const meta = {
    source: "preview",
    location: input.platform.businessAddress || undefined,
  };
  const vars = reminderAppointmentMergeVars({
    platform: input.platform,
    metadata: meta,
    firstName: "Alex",
    businessName: input.platform.businessDisplayName || input.workspaceName,
    service: input.serviceName || "Consultation",
    startsAt,
    timezone: input.platform.timezone,
    confirmToken: input.tokens?.confirm || "preview",
    cancelToken: input.tokens?.cancel || "preview",
    rescheduleToken: input.tokens?.reschedule || "preview",
  });
  const rendered = renderAppointmentTemplate(input.step.template, vars);
  if (input.step.channel === "sms") {
    return finalizeReminderSmsBody(rendered);
  }
  return rendered;
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
  if (step.channel !== "sms") {
    throw new Error("This reminder step is not configured for SMS");
  }

  const { resolveAppointmentOutboundSmsRoute } = await import("@/lib/appointments/sms-sender");
  const route = await resolveAppointmentOutboundSmsRoute(workspaceId);
  if (!route) {
    throw new Error(
      "Platform appointment SMS sender is not configured. Reminders must send from the Transovo platform number (same as Missed Call Text Back), not your business line.",
    );
  }

  const startsAt = new Date(Date.now() + 86400000);
  const previewMeta: AppointmentMetadata = {
    inviteeName: "Alex",
    source: "test",
  };
  const smsCore = await buildReminderSmsBodyForOutbound({
    workspaceId,
    stepKey: input.stepKey,
    step,
    firstName: "Alex",
    businessName: workspace?.displayName || workspace?.name || "Business",
    service: "Consultation",
    startsAt,
    timezone: platform.timezone,
    metadata: previewMeta,
  });
  const body = `[TEST] ${smsCore}`;

  const reservation = await reserveArReminderSmsUnit({
    workspaceId,
    excludeFromUsage: true,
  });
  if (!reservation.reserved && reservation.reason === "ar_sms_limit_reached") {
    throw new Error("Monthly Appointment Reminders SMS allowance reached");
  }

  try {
    await sendInternationalAppointmentSms({ workspaceId, to: input.phone, body });
  } catch (err) {
    await releaseArReminderSmsReservation({ workspaceId });
    throw err;
  }
  return { body, fromE164: route.fromE164 };
}

export async function sendTestReminderEmail(
  workspaceId: string,
  input: { stepKey: string; email: string },
) {
  const prisma = getPrisma();
  const [platform, workspace] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { displayName: true, name: true, logoUrl: true },
    }),
  ]);
  const { resolveReminderStep } = await import("@/lib/appointments/reminders/reminders-config");
  const step = resolveReminderStep(platform, input.stepKey);
  if (!step) throw new Error("Reminder step not found");
  if (!step.enabled) throw new Error("This reminder step is disabled");
  if (step.channel !== "email") {
    throw new Error("This reminder step is not configured for email");
  }

  const businessName = workspace?.displayName || workspace?.name || "Business";
  const startsAt = new Date(Date.now() + 86400000);
  const body = previewReminderMessage({
    step,
    platform,
    workspaceName: businessName,
  });
  const { stepEmailSubjectDefault } = await import("@/lib/appointment-reminders/reminder-presets");
  const subject = renderAppointmentTemplate(stepEmailSubjectDefault(step, businessName), appointmentMergeVars({
    firstName: "Alex",
    businessName,
    service: "Consultation",
    startsAt,
    timezone: platform.timezone,
    confirmLink: publicActionUrl("confirm", "preview"),
    cancelLink: publicActionUrl("cancel", "preview"),
    rescheduleLink: publicActionUrl("reschedule", "preview"),
    manageLink: publicActionUrl("reschedule", "preview"),
  }));

  const branding = {
    ...platform.reminderEmailBranding,
    logoUrl: platform.reminderEmailBranding?.logoUrl || workspace?.logoUrl || undefined,
  };

  const { sendTransactionalEmail } = await import("@/lib/email/brevo");
  const { wrapReminderEmailHtml } = await import("@/lib/appointment-reminders/reminder-email-html");
  const html = wrapReminderEmailHtml({
    bodyHtml: `[TEST] ${body.replace(/\n/g, "<br/>")}`,
    businessName,
    branding,
    preparationInstructions: platform.reminderPreferences?.preparationInstructions,
    cancellationPolicyText: platform.reminderPreferences?.cancellationPolicyText,
    actionLinks: {
      confirm: publicActionUrl("confirm", "preview"),
      reschedule: publicActionUrl("reschedule", "preview"),
      cancel: publicActionUrl("cancel", "preview"),
    },
  });

  await sendTransactionalEmail({
    to: input.email.trim(),
    subject: `[TEST] ${subject}`,
    htmlContent: html,
    textContent: `[TEST] ${body}`,
  });

  return { subject, body };
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

export async function trySendStepForDispatch(input: {
  dispatchId: string;
  workspaceId: string;
  appointmentId: string;
  timelineType: string;
  stepKey: string;
}): Promise<
  | { outcome: "sent"; providerMessageId?: string; telnyxMessageId?: string }
  | { outcome: "blocked"; detail: string }
  | { outcome: "unknown"; detail: string }
> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return { outcome: "blocked", detail: "appointment_not_found" };

  const meta = (row.metadata || {}) as AppointmentMetadata;
  const { shouldHoldRemindersForAppointment } = await import(
    "@/lib/appointment-reminders/ai-rescheduler/ar-reminder-guard"
  );
  if (shouldHoldRemindersForAppointment(meta)) {
    return { outcome: "blocked", detail: "ar_reconcile_pending" };
  }

  const config = await loadAppointmentPlatformConfig(input.workspaceId);
  const steps = configuredReminderSteps(config);
  const scheduled = steps.find((s) => s.timelineType === input.timelineType);
  if (!scheduled) return { outcome: "blocked", detail: "step_not_configured" };

  const connectionId = await resolveAppointmentCalendarConnectionId(input.workspaceId, meta);
  const calendarDefaults = await resolvePerCalendarReminderDefaults(input.workspaceId, connectionId);
  const effectiveStep = applyCalendarReminderDefaults(scheduled.step, calendarDefaults);
  if (!effectiveStep.enabled) return { outcome: "blocked", detail: "step_disabled" };

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { displayName: true, name: true },
  });
  const contact = row.contactId
    ? await prisma.contact.findFirst({
        where: { id: row.contactId, workspaceId: input.workspaceId },
        select: { phone: true, email: true },
      })
    : null;
  const phone = inviteePhone(meta, contact?.phone);
  const email = inviteeEmail(meta, contact?.email);
  if (!phone && !email) return { outcome: "blocked", detail: "no_recipient" };

  try {
    const ok = await trySendStep({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      startsAt: row.startsAt,
      serviceName: row.serviceName,
      timezone: row.timezone || config.timezone,
      stepKey: input.stepKey,
      step: effectiveStep,
      timelineType: input.timelineType,
      appointmentStatus: row.status,
      metadata: meta,
      phone: phone || "",
      email,
      businessName: workspace?.displayName || workspace?.name || "our team",
      confirmToken: meta.confirmToken,
      cancelToken: meta.cancelToken,
      rescheduleToken: meta.rescheduleToken,
    });
    if (!ok) return { outcome: "blocked", detail: "send_returned_false" };
    const dispatch = await prisma.arReminderDispatch.findUnique({
      where: { id: input.dispatchId },
      select: { telnyxMessageId: true, providerMessageId: true },
    });
    return {
      outcome: "sent",
      providerMessageId: dispatch?.providerMessageId,
      telnyxMessageId: dispatch?.telnyxMessageId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/timeout|ETIMEDOUT|ECONNRESET|abort/i.test(message)) {
      return { outcome: "unknown", detail: message };
    }
    return { outcome: "blocked", detail: message };
  }
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

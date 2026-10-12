import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { mergeConversationState } from "@/lib/appointments/ai-scheduling/conversation-state";
import { updatePlatformAppointmentStatus } from "@/lib/appointments/booking-platform";
import { suppressAppointmentReminders } from "@/lib/appointments/reminder-state";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { evaluateCancellationPolicy } from "@/lib/appointments/scheduling-policy";
import {
  resolveReminderBoundAppointment,
  recordReminderSmsContext,
} from "./reminder-reply-context";
import {
  isAiReschedulerSmsEnabled,
  resolveAiReschedulerConfig,
} from "./types";
import { cancelProviderEvent } from "./provider-mutations";
import { cancelPlatformAppointment } from "@/lib/appointments/booking-platform";
import { notifyBusinessRescheduleInterest } from "./business-approval";
import { evaluateArCustomerActionEligibility } from "./appointment-eligibility";
import { reflectCustomerConfirmationOnProvider } from "./confirm-calendar";
import { triggerArCalendarWriteBack } from "@/lib/appointment-reminders/calendar-write-back/trigger";
import {
  evaluateArSmsActionPolicy,
  resolveArCancelSmsPolicy,
  resolveArRescheduleSmsPolicy,
} from "./ar-sms-action-policy";
import {
  consumePolicyAck,
  gateArSmsCalendarWriteByPolicy,
  getArSmsPolicyAck,
  mergePolicyAckIntoMetadata,
} from "./ar-sms-policy-ack";
import { ensureArSmsPolicyWarningDelivered } from "./ar-sms-policy-ack-inbound";
import { recordArSmsCustomerOutcome } from "../record-ar-sms-outcome";

export type ArInboundReplyResult =
  | { handled: true; replyText: string; openedRescheduleFlow?: boolean }
  | { handled: false };

async function loadAppointmentForActions(
  workspaceId: string,
  appointmentId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId, contactId },
    include: { contact: { select: { phone: true } } },
  });
  return row;
}

async function formatWhen(
  workspaceId: string,
  appointmentId: string,
): Promise<string> {
  const row = await getPrisma().voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
    select: { startsAt: true, timezone: true },
  });
  if (!row) return "your appointment";
  return row.startsAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: row.timezone || undefined,
  });
}

export async function handleArCancelConfirmation(input: {
  workspaceId: string;
  contactId: string;
  appointmentId?: string;
}): Promise<ArInboundReplyResult> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      ...(input.appointmentId?.trim() ? { id: input.appointmentId.trim() } : {}),
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
    orderBy: { startsAt: "asc" },
  });
  if (!row) return { handled: false };
  const meta = (row.metadata || {}) as AppointmentMetadata & {
    arCancelPending?: { requestedAt: string };
  };
  if (!meta.arCancelPending) return { handled: false };

  const { resolveArAiReschedulerConfigForWorkspace } = await import(
    "@/lib/appointment-reminders/commercial/ar-ai-rescheduler-plan"
  );
  const ar = await resolveArAiReschedulerConfigForWorkspace(input.workspaceId);
  const whenLabel = await formatWhen(input.workspaceId, row.id);
  const cancelPolicy = resolveArCancelSmsPolicy(ar);
  const policyGate = gateArSmsCalendarWriteByPolicy({
    meta,
    action: "cancel",
    startsAt: row.startsAt,
    policy: cancelPolicy,
  });
  if (!policyGate.allowed) {
    return { handled: true, replyText: policyGate.customerMessage };
  }

  if (ar.allowProviderCancel && ar.mode === "ai") {
    const provider = await cancelProviderEvent({
      workspaceId: input.workspaceId,
      appointmentId: row.id,
      reason: "Customer confirmed cancellation via SMS",
    });
    if (!provider.ok) {
      return {
        handled: true,
        replyText:
          "We couldn't cancel that appointment on the calendar. The business has been notified.",
      };
    }
  }
  await cancelPlatformAppointment(input.workspaceId, row.id, "customer");
  await recordArSmsCustomerOutcome({
    workspaceId: input.workspaceId,
    appointmentId: row.id,
    outcome: "cancelled",
    evidence: {
      calendarResult: "verified",
      action: "cancel",
      operationId: policyGate.ack?.operationId,
    },
  });
  await triggerArCalendarWriteBack({
    workspaceId: input.workspaceId,
    appointmentId: row.id,
    kind: "canceled",
  });
  const fresh = await prisma.voiceAppointment.findFirst({ where: { id: row.id } });
  if (fresh) {
    let ackMeta = (fresh.metadata || {}) as AppointmentMetadata;
    const ack = getArSmsPolicyAck(ackMeta);
    if (ack && policyGate.ack) {
      ackMeta = mergePolicyAckIntoMetadata(ackMeta, consumePolicyAck(ack, "cancel"));
    }
    const nextMeta = suppressAppointmentReminders({
      ...ackMeta,
      arCancelPending: undefined,
    });
    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: { metadata: nextMeta as object },
    });
  }
  return {
    handled: true,
    replyText: `Your appointment on ${whenLabel} has been cancelled.`,
  };
}

export async function beginArCancelPendingAfterPolicyAck(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId?: string;
  whenLabel: string;
  meta: AppointmentMetadata;
  customerMessage?: string;
  providerMessageId?: string;
}): Promise<string> {
  const prisma = getPrisma();
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      metadata: {
        ...input.meta,
        arCancelPending: { requestedAt: new Date().toISOString() },
      } as object,
    },
  });
  if (input.replySessionId) {
    const { markArReplySessionLifecycle } = await import(
      "@/lib/appointment-reminders/messaging/reply-session"
    );
    await markArReplySessionLifecycle({
      sessionId: input.replySessionId,
      workspaceId: input.workspaceId,
      lifecycleState: "AWAITING_CANCEL_CONFIRM",
    });
  }
  const msg = input.customerMessage?.trim();
  await recordArSmsCustomerOutcome({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    outcome: "cancel_pending",
    note: msg ? `Customer texted: "${msg.slice(0, 240)}"` : undefined,
    evidence: msg
      ? {
          channel: "sms",
          direction: "inbound",
          messageText: msg,
          providerMessageId: input.providerMessageId,
          action: "cancel",
        }
      : undefined,
  });
  await triggerArCalendarWriteBack({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    kind: "cancellation_requested",
  });
  return `Reply YES to confirm you want to cancel your appointment on ${input.whenLabel}.`;
}

export async function continueArRescheduleAfterPolicyAcceptance(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId?: string;
  whenLabel: string;
  meta: AppointmentMetadata;
  ar: ReturnType<typeof resolveAiReschedulerConfig>;
}): Promise<ArInboundReplyResult> {
  if (input.replySessionId) {
    const { markArReplySessionLifecycle } = await import(
      "@/lib/appointment-reminders/messaging/reply-session"
    );
    await markArReplySessionLifecycle({
      sessionId: input.replySessionId,
      workspaceId: input.workspaceId,
      lifecycleState: "RESCHEDULING",
    });
  }

  const prisma = getPrisma();
  await prisma.contact.update({
    where: { id: input.contactId },
    data: {
      customFields: mergeConversationState(
        (
          await prisma.contact.findFirst({
            where: { id: input.contactId },
            select: { customFields: true },
          })
        )?.customFields,
        {
          appointmentId: input.appointmentId,
          activeIntent: "RESCHEDULE",
        },
      ) as object,
    },
  });

  if (input.ar.mode === "notify") {
    await prisma.voiceAppointment.update({
      where: { id: input.appointmentId },
      data: {
        metadata: {
          ...input.meta,
          arRescheduleRequest: {
            status: "pending_business",
            requestedAt: new Date().toISOString(),
            channel: "sms",
          },
        } as object,
        status: "reschedule_requested",
      },
    });
    await notifyBusinessRescheduleInterest({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      message: `Customer asked to reschedule the appointment on ${input.whenLabel}.`,
    });
    await recordArSmsCustomerOutcome({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      replySessionId: input.replySessionId,
      outcome: "reschedule_requested",
    });
    await triggerArCalendarWriteBack({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      kind: "reschedule_requested",
    });
    return {
      handled: true,
      replyText: `Thanks — we received your request to reschedule your appointment on ${input.whenLabel}. The business will follow up shortly.`,
    };
  }

  await recordArSmsCustomerOutcome({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    outcome: "reschedule_started",
  });
  return {
    handled: true,
    openedRescheduleFlow: true,
    replyText: `Sure — what day or time works better for your appointment on ${input.whenLabel}?`,
  };
}

export async function handleArReminderLetterReply(input: {
  workspaceId: string;
  contactId: string;
  conversationId?: string;
  explicitAppointmentId?: string;
  replySessionId?: string;
  body: string;
  letter: "C" | "R" | "X";
  providerMessageId?: string;
}): Promise<ArInboundReplyResult> {
  const { resolveArAiReschedulerConfigForWorkspace } = await import(
    "@/lib/appointment-reminders/commercial/ar-ai-rescheduler-plan"
  );
  const ar = await resolveArAiReschedulerConfigForWorkspace(input.workspaceId);
  if (!isAiReschedulerSmsEnabled(ar)) return { handled: false };

  let appointmentId: string | null = input.explicitAppointmentId?.trim() || null;
  if (!appointmentId) {
    const bound = await resolveReminderBoundAppointment({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      explicitAppointmentId: input.explicitAppointmentId,
    });
    if (!bound) return { handled: false };
    if ("ambiguous" in bound) {
      return {
        handled: true,
        replyText:
          "I see more than one upcoming appointment. Please reply with the date of the appointment you mean.",
      };
    }
    appointmentId = bound.appointmentId;
  }
  const row = await loadAppointmentForActions(input.workspaceId, appointmentId, input.contactId);
  if (!row) return { handled: false };

  const eligibility = evaluateArCustomerActionEligibility({
    appointmentId,
    contactId: input.contactId,
    status: row.status,
    metadata: (row.metadata || {}) as AppointmentMetadata,
    inviteePhone: (row.metadata as AppointmentMetadata)?.inviteePhone,
    contactPhone: row.contact?.phone,
  });
  if (!eligibility.eligible) {
    return {
      handled: true,
      replyText:
        "We couldn't match that to an appointment we can update by text. The business will follow up if needed.",
    };
  }

  const whenLabel = await formatWhen(input.workspaceId, appointmentId);
  const meta = (row.metadata || {}) as AppointmentMetadata;

  if (input.letter === "C") {
    if (row.status === "confirmed" && meta.arCustomerConfirmedAt) {
      return {
        handled: true,
        replyText: `Your appointment on ${whenLabel} is already confirmed.`,
      };
    }
    await updatePlatformAppointmentStatus(input.workspaceId, appointmentId, "confirmed", {
      type: "confirmed_via_sms",
      label: "Customer replied C to confirm reminder",
    });
    await reflectCustomerConfirmationOnProvider({
      workspaceId: input.workspaceId,
      appointmentId,
    });
    await recordArSmsCustomerOutcome({
      workspaceId: input.workspaceId,
      appointmentId,
      replySessionId: input.replySessionId,
      outcome: "confirmed",
    });
    return {
      handled: true,
      replyText: `Your appointment on ${whenLabel} is confirmed.`,
    };
  }

  if (input.letter === "X") {
    const cancelSms = evaluateArSmsActionPolicy({
      action: "cancel",
      startsAt: row.startsAt,
      policy: resolveArCancelSmsPolicy(ar),
    });
    if (!cancelSms.allowsAutomatedAction) {
      return {
        handled: true,
        replyText:
          "Cancellation by text isn't available this close to your appointment. Please contact the business directly.",
      };
    }

    const policy = evaluateCancellationPolicy(platform.cancellationPolicy, row.startsAt);
    if (!policy.allowed) {
      return {
        handled: true,
        replyText: policy.reason || "Cancellation isn't available for this appointment by text.",
      };
    }

    const pending = (meta as { arCancelPending?: { requestedAt: string } }).arCancelPending;
    const policyWarning = await ensureArSmsPolicyWarningDelivered({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      appointmentId,
      replySessionId: input.replySessionId,
      conversationId: input.conversationId,
      action: "cancel",
      ar,
      whenLabel,
      startsAt: row.startsAt,
    });
    if (policyWarning.required && !policyWarning.alreadyAccepted) {
      return { handled: true, replyText: policyWarning.replyText };
    }

    if (!pending) {
      const confirmLine = await beginArCancelPendingAfterPolicyAck({
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        appointmentId,
        replySessionId: input.replySessionId,
        whenLabel,
        meta,
        customerMessage: input.body,
        providerMessageId: input.providerMessageId,
      });
      return { handled: true, replyText: confirmLine };
    }

    return {
      handled: true,
      replyText: `Reply YES to confirm cancellation of your appointment on ${whenLabel}.`,
    };
  }

  // R — reschedule (notify-only still collects request; AI mode opens conversation)
  const rescheduleSms = evaluateArSmsActionPolicy({
    action: "reschedule",
    startsAt: row.startsAt,
    policy: resolveArRescheduleSmsPolicy(ar),
  });
  if (!rescheduleSms.allowsAutomatedAction) {
    return {
      handled: true,
      replyText:
        "Rescheduling by text isn't available this close to your appointment. Please contact the business directly if you need help.",
    };
  }
  const reschedulePolicyWarning = await ensureArSmsPolicyWarningDelivered({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId,
    replySessionId: input.replySessionId,
    conversationId: input.conversationId,
    action: "reschedule",
    ar,
    whenLabel,
    startsAt: row.startsAt,
  });
  if (reschedulePolicyWarning.required && !reschedulePolicyWarning.alreadyAccepted) {
    return { handled: true, replyText: reschedulePolicyWarning.replyText };
  }

  return continueArRescheduleAfterPolicyAcceptance({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId,
    replySessionId: input.replySessionId,
    whenLabel,
    meta,
    ar,
  });
}

export async function seedRescheduleConversationOnReminderSend(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  reminderGeneration?: number;
  timelineType?: string;
  outboundProviderMessageId?: string;
}) {
  await recordReminderSmsContext(input);
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  if (!row) return;
  const meta = (row.metadata || {}) as AppointmentMetadata;
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      metadata: {
        ...meta,
        lastReminderSmsAt: new Date().toISOString(),
        lastReminderTimelineType: input.timelineType,
      } as object,
    },
  });
}

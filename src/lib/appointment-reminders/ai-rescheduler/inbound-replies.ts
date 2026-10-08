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

export type ArInboundReplyResult =
  | { handled: true; replyText: string }
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

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  const whenLabel = await formatWhen(input.workspaceId, row.id);

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
  const fresh = await prisma.voiceAppointment.findFirst({ where: { id: row.id } });
  if (fresh) {
    const nextMeta = suppressAppointmentReminders({
      ...(fresh.metadata as AppointmentMetadata),
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

export async function handleArReminderLetterReply(input: {
  workspaceId: string;
  contactId: string;
  conversationId?: string;
  explicitAppointmentId?: string;
  replySessionId?: string;
  body: string;
  letter: "C" | "R" | "X";
}): Promise<ArInboundReplyResult> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
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
    return {
      handled: true,
      replyText: `Your appointment on ${whenLabel} is confirmed.`,
    };
  }

  if (input.letter === "X") {
    const policy = evaluateCancellationPolicy(platform.cancellationPolicy, row.startsAt);
    if (!policy.allowed) {
      return {
        handled: true,
        replyText: policy.reason || "Cancellation isn't available for this appointment by text.",
      };
    }

    const pending = (meta as { arCancelPending?: { requestedAt: string } }).arCancelPending;
    if (!pending) {
      const prisma = getPrisma();
      await prisma.voiceAppointment.update({
        where: { id: appointmentId },
        data: {
          metadata: {
            ...meta,
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
      return {
        handled: true,
        replyText: `Reply YES to confirm you want to cancel your appointment on ${whenLabel}.`,
      };
    }

    return {
      handled: true,
      replyText: `Reply YES to confirm cancellation of your appointment on ${whenLabel}.`,
    };
  }

  // R — reschedule (notify-only still collects request; AI mode opens conversation)
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
          appointmentId,
          activeIntent: "RESCHEDULE",
        },
      ) as object,
    },
  });

  if (ar.mode === "notify") {
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: {
          ...meta,
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
      appointmentId,
      message: `Customer asked to reschedule the appointment on ${whenLabel}.`,
    });
    return {
      handled: true,
      replyText: `Thanks — we received your request to reschedule your appointment on ${whenLabel}. The business will follow up shortly.`,
    };
  }

  return {
    handled: true,
    replyText: `Sure — what day or time works better for your appointment on ${whenLabel}?`,
  };
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

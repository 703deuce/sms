import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { mergeConversationState } from "@/lib/appointments/ai-scheduling/conversation-state";
import { updatePlatformAppointmentStatus } from "@/lib/appointments/booking-platform";
import { suppressAppointmentReminders } from "@/lib/appointments/reminder-state";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  resolveReminderBoundAppointment,
  recordReminderSmsContext,
} from "./reminder-reply-context";
import {
  isAiReschedulerSmsEnabled,
  resolveAiReschedulerConfig,
  isAiAutomaticCalendarMutation,
} from "./types";
import { cancelProviderEvent } from "./provider-mutations";
import { cancelPlatformAppointment } from "@/lib/appointments/booking-platform";

export type ArInboundReplyResult =
  | { handled: true; replyText: string }
  | { handled: false };

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

export async function handleArReminderLetterReply(input: {
  workspaceId: string;
  contactId: string;
  conversationId?: string;
  body: string;
  letter: "C" | "R" | "X";
}): Promise<ArInboundReplyResult> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  if (!isAiReschedulerSmsEnabled(ar)) return { handled: false };

  const bound = await resolveReminderBoundAppointment({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
  });
  if (!bound) return { handled: false };
  if ("ambiguous" in bound) {
    return {
      handled: true,
      replyText:
        "I see more than one upcoming appointment. Please reply with the date of the appointment you mean.",
    };
  }

  const appointmentId = bound.appointmentId;
  const whenLabel = await formatWhen(input.workspaceId, appointmentId);

  if (input.letter === "C") {
    await updatePlatformAppointmentStatus(input.workspaceId, appointmentId, "confirmed", {
      type: "confirmed_via_sms",
      label: "Customer replied C to confirm reminder",
    });
    return {
      handled: true,
      replyText: `Your appointment on ${whenLabel} is confirmed.`,
    };
  }

  if (input.letter === "X") {
    if (ar.allowProviderCancel && ar.mode === "ai") {
      const provider = await cancelProviderEvent({
        workspaceId: input.workspaceId,
        appointmentId,
        reason: "Customer requested cancellation via SMS",
      });
      if (!provider.ok) {
        return {
          handled: true,
          replyText:
            "We couldn't cancel that appointment automatically. The business has been notified.",
        };
      }
    }
    await cancelPlatformAppointment(input.workspaceId, appointmentId, "customer");
    const prisma = getPrisma();
    const row = await prisma.voiceAppointment.findFirst({
      where: { id: appointmentId, workspaceId: input.workspaceId },
    });
    if (row) {
      const meta = suppressAppointmentReminders((row.metadata || {}) as AppointmentMetadata);
      await prisma.voiceAppointment.update({
        where: { id: appointmentId },
        data: { metadata: meta as object },
      });
    }
    return {
      handled: true,
      replyText: `Your appointment on ${whenLabel} has been cancelled.`,
    };
  }

  // R — reschedule
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
    const meta = (
      await prisma.voiceAppointment.findFirst({
        where: { id: appointmentId },
        select: { metadata: true },
      })
    )?.metadata as AppointmentMetadata;
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: {
          ...(meta || {}),
          arRescheduleRequest: {
            status: "pending_business",
            requestedAt: new Date().toISOString(),
            channel: "sms",
          },
        } as object,
        status: "reschedule_requested",
      },
    });
    return {
      handled: true,
      replyText: `Thanks — we received your request to reschedule your appointment on ${whenLabel}. The business will follow up shortly.`,
    };
  }

  if (!isAiAutomaticCalendarMutation(ar) && ar.approval === "business") {
    return {
      handled: true,
      replyText: `Sure — what day or time works better for your appointment on ${whenLabel}?`,
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
      } as object,
    },
  });
}

import "server-only";

import { getPrisma } from "@/lib/db";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import { AR_REPLY_ELIGIBLE_STATES } from "./ar-platform-sender-pool";
import { allocateArPlatformSenderForReminder } from "./ar-consumer-platform-sender-assignment";

const DEFAULT_REPLY_ELIGIBLE_MS = 21 * 24 * 60 * 60 * 1000;

export function arReplyEligibleUntilFromNow(): Date {
  const days = Number(process.env.AR_SMS_REPLY_ELIGIBLE_DAYS || "21");
  const ms = Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : DEFAULT_REPLY_ELIGIBLE_MS;
  return new Date(Date.now() + ms);
}

export type ArSenderSelectionResult =
  | {
      ok: true;
      phoneNumberId: string;
      e164: string;
      provider: string;
      reusedExistingAppointmentSender: boolean;
    }
  | { ok: false; reason: string; pendingSendReason: string };

export async function selectArOutboundPlatformSender(input: {
  workspaceId: string;
  appointmentId: string;
  consumerE164: string;
}): Promise<ArSenderSelectionResult> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);

  const persistentSender = await prisma.arSmsReplySession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      consumerE164: consumer,
      lifecycleState: { not: "EXPIRED" },
      OR: [
        { lastOutboundProviderMessageId: { not: null } },
        { lastOutboundMessageId: { not: null } },
      ],
    },
    orderBy: { lastUsedAt: "desc" },
    include: { platformPhoneNumber: { select: { id: true, e164: true, provider: true } } },
  });
  if (persistentSender?.platformPhoneNumber?.e164) {
    return {
      ok: true,
      phoneNumberId: persistentSender.platformPhoneNumberId,
      e164: persistentSender.platformPhoneNumber.e164,
      provider: String(
        persistentSender.provider || persistentSender.platformPhoneNumber.provider || "telnyx",
      ),
      reusedExistingAppointmentSender: true,
    };
  }

  const existingForAppointment = await prisma.arSmsReplySession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
    },
    orderBy: { lastUsedAt: "desc" },
    include: { platformPhoneNumber: { select: { id: true, e164: true, provider: true } } },
  });
  if (existingForAppointment?.platformPhoneNumber?.e164) {
    return {
      ok: true,
      phoneNumberId: existingForAppointment.platformPhoneNumberId,
      e164: existingForAppointment.platformPhoneNumber.e164,
      provider: String(existingForAppointment.provider || existingForAppointment.platformPhoneNumber.provider || "telnyx"),
      reusedExistingAppointmentSender: true,
    };
  }

  const allocated = await allocateArPlatformSenderForReminder({
    workspaceId: input.workspaceId,
    consumerE164: consumer,
  });
  if (!allocated.ok) {
    return allocated;
  }
  return {
    ok: true,
    phoneNumberId: allocated.phoneNumberId,
    e164: allocated.e164,
    provider: allocated.provider,
    reusedExistingAppointmentSender: allocated.reusedExistingAppointmentSender,
  };
}

export async function claimArReplySessionForOutbound(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  provider: string;
  timelineType: string;
  conversationId?: string | null;
}): Promise<{ sessionId: string } | { collision: true; ownerAppointmentId: string }> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const replyEligibleUntil = arReplyEligibleUntilFromNow();

  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId, contactId: input.contactId },
    select: {
      id: true,
      externalId: true,
      metadata: true,
      timezone: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!appt) {
    throw new Error("ar_reply_session_appointment_not_found");
  }

  const providerRef = providerRefFromAppointment(appt);
  const calendarConnectionId = providerRef?.connectionId ?? null;
  const providerEventId = providerRef?.providerEventId ?? null;
  const providerCalendarId = providerRef?.providerCalendarId ?? null;
  const calendarProvider = providerRef?.provider ?? null;

  type ClaimTxResult = { sessionId: string } | { collision: true; ownerAppointmentId: string };

  const result: ClaimTxResult = await prisma.$transaction(async (tx) => {
    const existingApptSession = await tx.arSmsReplySession.findFirst({
      where: {
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
      },
    });
    if (existingApptSession) {
      const updated = await tx.arSmsReplySession.update({
        where: { id: existingApptSession.id },
        data: {
          lastUsedAt: new Date(),
          replyEligibleUntil,
          timelineType: input.timelineType,
          lifecycleState:
            existingApptSession.lifecycleState === "COMPLETED"
              ? "AWAITING_REPLY"
              : existingApptSession.lifecycleState,
          completedAt:
            existingApptSession.lifecycleState === "COMPLETED" ? null : existingApptSession.completedAt,
          ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        },
      });
      return { sessionId: updated.id };
    }

    const created = await tx.arSmsReplySession.create({
      data: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        appointmentId: input.appointmentId,
        conversationId: input.conversationId ?? null,
        platformPhoneNumberId: input.platformPhoneNumberId,
        provider: input.provider,
        consumerE164: consumer,
        lifecycleState: "AWAITING_REPLY",
        timelineType: input.timelineType,
        calendarConnectionId,
        providerCalendarId,
        providerEventId,
        calendarProvider,
        replyEligibleUntil,
      },
    });
    return { sessionId: created.id };
  });

  if ("collision" in result && result.collision) {
    return { collision: true, ownerAppointmentId: result.ownerAppointmentId };
  }
  return { sessionId: result.sessionId };
}

/**
 * Same platform sender + customer may only have one reply-eligible appointment at a time.
 * New reminder send supersedes older AR sessions on that sender (latest C/R/X wins).
 */
export async function expireSupersededArReplySessionsOnSender(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
  keepAppointmentId: string;
}) {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  await prisma.arSmsReplySession.updateMany({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      appointmentId: { not: input.keepAppointmentId },
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
    },
    data: {
      lifecycleState: "EXPIRED",
      completedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });
}

export async function attachOutboundProofToArReplySession(input: {
  sessionId: string;
  workspaceId: string;
  outboundMessageId?: string;
  outboundProviderMessageId?: string;
}) {
  const prisma = getPrisma();
  await prisma.arSmsReplySession.updateMany({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
    data: {
      lastOutboundMessageId: input.outboundMessageId ?? undefined,
      lastOutboundProviderMessageId: input.outboundProviderMessageId ?? undefined,
      lastUsedAt: new Date(),
    },
  });
}

export async function findReplyEligibleArSessionsForInbound(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}) {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const now = new Date();
  return prisma.arSmsReplySession.findMany({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
      OR: [{ replyEligibleUntil: null }, { replyEligibleUntil: { gt: now } }],
    },
    orderBy: { lastUsedAt: "desc" },
  });
}

export async function loadArReplySessionForWorkspace(input: {
  sessionId: string;
  workspaceId: string;
}) {
  const prisma = getPrisma();
  return prisma.arSmsReplySession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
  });
}

export async function markArReplySessionLifecycle(input: {
  sessionId: string;
  workspaceId: string;
  lifecycleState:
    | "AWAITING_REPLY"
    | "RESCHEDULING"
    | "AWAITING_CANCEL_CONFIRM"
    | "AWAITING_STAFF_APPROVAL"
    | "COMPLETED"
    | "EXPIRED"
    | "NEEDS_CLARIFICATION";
}) {
  const prisma = getPrisma();
  await prisma.arSmsReplySession.updateMany({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
    data: {
      lifecycleState: input.lifecycleState,
      lastUsedAt: new Date(),
      ...(input.lifecycleState === "COMPLETED" || input.lifecycleState === "EXPIRED"
        ? { completedAt: new Date() }
        : {}),
    },
  });
}

export async function ensureArConversation(input: {
  workspaceId: string;
  contactId: string;
  toE164: string;
  fromE164: string;
  platformPhoneNumberId?: string;
  appointmentId?: string;
  existingConversationId?: string | null;
}): Promise<string> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.fromE164);

  if (input.existingConversationId) {
    await prisma.conversation.updateMany({
      where: { id: input.existingConversationId, workspaceId: input.workspaceId },
      data: { productSource: "APPOINTMENT_REMINDERS", updatedAt: new Date() },
    });
    return input.existingConversationId;
  }

  const { findPersistentArConversationId, syncArReplySessionsToConversation } = await import(
    "./persistent-conversation"
  );

  if (input.platformPhoneNumberId) {
    const persistent = await findPersistentArConversationId({
      workspaceId: input.workspaceId,
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
    });
    if (persistent) {
      await prisma.conversation.updateMany({
        where: { id: persistent, workspaceId: input.workspaceId },
        data: { productSource: "APPOINTMENT_REMINDERS", updatedAt: new Date() },
      });
      await syncArReplySessionsToConversation({
        workspaceId: input.workspaceId,
        consumerE164: consumer,
        platformPhoneNumberId: input.platformPhoneNumberId,
        conversationId: persistent,
      });
      return persistent;
    }
  }

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.platformPhoneNumberId ?? undefined, status: "Active" },
    select: { id: true },
  });

  const created = await prisma.conversation.create({
    data: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      productSource: "APPOINTMENT_REMINDERS",
      tags: ["appointment_reminders"],
      phoneNumberId: phone?.id ?? null,
      fromE164: input.toE164,
      unread: false,
    },
    select: { id: true },
  });

  if (input.platformPhoneNumberId) {
    await syncArReplySessionsToConversation({
      workspaceId: input.workspaceId,
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      conversationId: created.id,
    });
  }

  return created.id;
}

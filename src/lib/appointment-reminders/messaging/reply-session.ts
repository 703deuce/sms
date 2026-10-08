import "server-only";

import { getPrisma } from "@/lib/db";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import {
  AR_REPLY_ELIGIBLE_STATES,
  findOccupiedArSenderIdsForConsumer,
  listArEligiblePlatformSenders,
  pickFirstUnoccupiedPlatformSender,
} from "./ar-platform-sender-pool";

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

  const senders = await listArEligiblePlatformSenders();
  if (!senders.length) {
    return {
      ok: false,
      reason: "ar_no_eligible_platform_sender",
      pendingSendReason:
        "Canonical Telnyx platform sender (866) is not configured or authorized for Appointment Reminders",
    };
  }

  const occupied = await findOccupiedArSenderIdsForConsumer(consumer);
  const picked = pickFirstUnoccupiedPlatformSender(senders, occupied);
  if (picked) {
    return {
      ok: true,
      phoneNumberId: picked.phoneNumberId,
      e164: picked.e164,
      provider: picked.provider,
      reusedExistingAppointmentSender: false,
    };
  }

  return {
    ok: false,
    reason: "ar_sender_pool_exhausted",
    pendingSendReason:
      "This customer already has active appointment reminder conversations on all platform senders. Delay the reminder or wait for a reply window to expire.",
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
          ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        },
      });
      return { sessionId: updated.id };
    }

    const foreignOnSender = await tx.arSmsReplySession.findFirst({
      where: {
        consumerE164: consumer,
        platformPhoneNumberId: input.platformPhoneNumberId,
        lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
        NOT: { appointmentId: input.appointmentId },
      },
    });
    if (foreignOnSender) {
      return { collision: true as const, ownerAppointmentId: foreignOnSender.appointmentId };
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
  existingConversationId?: string | null;
}): Promise<string> {
  const prisma = getPrisma();
  if (input.existingConversationId) {
    await prisma.conversation.updateMany({
      where: { id: input.existingConversationId, workspaceId: input.workspaceId },
      data: { productSource: "APPOINTMENT_REMINDERS", updatedAt: new Date() },
    });
    return input.existingConversationId;
  }

  const { resolveInboundConversation } = await import("@/lib/mass-texting/conversation-context");
  const inboundCtx = await resolveInboundConversation({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    toE164: input.toE164,
    fromE164: input.fromE164,
  });

  const variants = mctbCallerE164Variants(input.fromE164);
  const arTagged = await prisma.conversation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      productSource: "APPOINTMENT_REMINDERS",
      contact: { phone: { in: variants } },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (arTagged) return arTagged.id;

  await prisma.conversation.update({
    where: { id: inboundCtx.conversationId },
    data: {
      productSource: "APPOINTMENT_REMINDERS",
      tags: ["appointment_reminders"],
      updatedAt: new Date(),
    },
  });
  return inboundCtx.conversationId;
}

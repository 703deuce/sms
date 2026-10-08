import "server-only";

import { getPrisma } from "@/lib/db";

export type HeldInboundCandidateContext = {
  product: "appointment_reminders" | "mctb";
  workspaceId: string;
  replySessionId?: string;
  appointmentId?: string;
  assignmentId?: string;
  conversationId?: string;
};

export async function persistArInboundHeldMessage(input: {
  providerMessageId: string;
  channel: "twilio" | "telnyx";
  fromE164: string;
  toE164: string;
  platformPhoneNumberId?: string;
  body: string;
  holdReason: string;
  candidateContexts: HeldInboundCandidateContext[];
  workspaceId?: string | null;
}): Promise<{ id: string }> {
  const prisma = getPrisma();
  const workspaceId =
    input.workspaceId ??
    (input.candidateContexts.length === 1 ? input.candidateContexts[0]!.workspaceId : null);

  const row = await prisma.arSmsInboundHeldMessage.upsert({
    where: { providerMessageId: input.providerMessageId },
    create: {
      workspaceId,
      providerMessageId: input.providerMessageId,
      channel: input.channel,
      fromE164: input.fromE164,
      toE164: input.toE164,
      platformPhoneNumberId: input.platformPhoneNumberId ?? null,
      bodyPreview: input.body.slice(0, 500),
      holdReason: input.holdReason,
      candidateContexts: input.candidateContexts as object,
      state: "HELD",
    },
    update: {
      holdReason: input.holdReason,
      candidateContexts: input.candidateContexts as object,
      bodyPreview: input.body.slice(0, 500),
      updatedAt: new Date(),
    },
  });
  return { id: row.id };
}

export async function listHeldInboundForWorkspace(workspaceId: string, limit = 50) {
  const prisma = getPrisma();
  const rows = await prisma.arSmsInboundHeldMessage.findMany({
    where: { state: "HELD" },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit * 4, 200),
  });
  return rows
    .filter((row) => {
      if (row.workspaceId === workspaceId) return true;
      const ctx = row.candidateContexts as HeldInboundCandidateContext[];
      return Array.isArray(ctx) && ctx.some((c) => c.workspaceId === workspaceId);
    })
    .slice(0, limit);
}

export async function resolveHeldInboundMessage(input: {
  heldMessageId: string;
  workspaceId: string;
  staffUserId: string;
  resolution: "dismiss" | "route_ar";
  replySessionId?: string;
  conversationId?: string;
  note?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const prisma = getPrisma();
  const row = await prisma.arSmsInboundHeldMessage.findUnique({
    where: { id: input.heldMessageId },
  });
  if (!row || row.state !== "HELD") {
    return { ok: false, message: "Held message not found or already resolved" };
  }

  const candidates = row.candidateContexts as HeldInboundCandidateContext[];
  const visible = candidates.filter((c) => c.workspaceId === input.workspaceId);
  if (!visible.length && row.workspaceId !== input.workspaceId) {
    return { ok: false, message: "Not authorized for this held message" };
  }

  if (input.resolution === "dismiss") {
    await prisma.arSmsInboundHeldMessage.update({
      where: { id: row.id },
      data: {
        state: "DISMISSED",
        resolvedWorkspaceId: input.workspaceId,
        resolvedByUserId: input.staffUserId,
        resolvedAt: new Date(),
        resolutionNote: input.note ?? "Dismissed by staff",
      },
    });
    return { ok: true };
  }

  if (!input.replySessionId) {
    return { ok: false, message: "replySessionId required to route to Appointment Reminders" };
  }

  const session = await prisma.arSmsReplySession.findFirst({
    where: { id: input.replySessionId, workspaceId: input.workspaceId },
  });
  if (!session) {
    return { ok: false, message: "Reply session not found in this workspace" };
  }

  const arCandidate = visible.find(
    (c) => c.product === "appointment_reminders" && c.replySessionId === input.replySessionId,
  );
  if (!arCandidate && !visible.some((c) => c.product === "appointment_reminders")) {
    return { ok: false, message: "Held message is not eligible for AR routing in this workspace" };
  }

  await acceptArInboundAfterManualHold({
    held: row,
    session,
  });

  await prisma.arSmsInboundHeldMessage.update({
    where: { id: row.id },
    data: {
      state: "RESOLVED",
      resolvedWorkspaceId: input.workspaceId,
      resolvedProduct: "appointment_reminders",
      resolvedReplySessionId: input.replySessionId,
      resolvedConversationId: input.conversationId ?? session.conversationId,
      resolvedByUserId: input.staffUserId,
      resolvedAt: new Date(),
      resolutionNote: input.note ?? "Manually routed to Appointment Reminders",
    },
  });

  return { ok: true };
}

async function acceptArInboundAfterManualHold(input: {
  held: {
    providerMessageId: string;
    fromE164: string;
    toE164: string;
    bodyPreview: string;
    channel: string;
  };
  session: {
    workspaceId: string;
    contactId: string;
    id: string;
    appointmentId: string;
  };
}) {
  const { acceptArInboundSmsIngress } = await import("./inbound-sms-ingress");

  await acceptArInboundSmsIngress({
    workspaceId: input.session.workspaceId,
    contactId: input.session.contactId,
    replySessionId: input.session.id,
    appointmentId: input.session.appointmentId,
    from: input.held.fromE164,
    to: input.held.toE164,
    body: input.held.bodyPreview,
    provider: input.held.channel === "twilio" ? "twilio" : "telnyx",
    providerMessageId: input.held.providerMessageId,
    mediaUrls: null,
  });
}

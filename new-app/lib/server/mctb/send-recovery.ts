import "server-only";

import { getPrisma } from "@/lib/server/db";
import { createId } from "@/lib/supabase/id";
import { renderMctbFirstTextTemplateBody } from "@/lib/mctb/first-text-templates/render";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { loadMctbRecoveryConfig } from "@/lib/server/mctb/config";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { ensureMctbConversationForRecovery } from "@/lib/server/mctb/ensure-conversation";

async function resolveBusinessName(workspaceId: string): Promise<string> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  return ws?.name?.trim() || "Our team";
}

export async function executeMctbRecoverySend(input: {
  workspaceId: string;
  missedCallEventId: string;
}): Promise<{ ok: boolean; reason?: string; messageId?: string }> {
  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findFirst({
    where: { id: input.missedCallEventId, workspaceId: input.workspaceId },
  });
  if (!event) return { ok: false, reason: "event_not_found" };
  if (event.smsSentAt || event.status === "SENT") {
    return { ok: true, reason: "already_sent" };
  }

  const config = await loadMctbRecoveryConfig(input.workspaceId);
  const businessName = await resolveBusinessName(input.workspaceId);
  const body = renderMctbFirstTextTemplateBody({
    config: config.firstTextTemplate,
    businessName,
    inBusinessHours: true,
  });

  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform?.e164) {
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", suppressionReason: "SENDER_UNAVAILABLE" },
    });
    return { ok: false, reason: "sender_unavailable" };
  }

  const to = normalizeE164(event.callerE164);
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) {
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", suppressionReason: "SENDER_UNAVAILABLE" },
    });
    return { ok: false, reason: "telnyx_not_configured" };
  }

  await prisma.missedCallEvent.update({
    where: { id: event.id },
    data: { status: "SENDING" },
  });

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: platform.e164, to, text: body }),
  });

  if (!res.ok) {
    const text = await res.text();
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        suppressionReason: "DELIVERY_FAILED",
        metadata: {
          ...(typeof event.metadata === "object" && event.metadata ? event.metadata : {}),
          deliveryError: text.slice(0, 500),
        },
      },
    });
    return { ok: false, reason: "delivery_failed" };
  }

  const payload = (await res.json()) as { data?: { id?: string } };
  const providerId = payload.data?.id ? String(payload.data.id) : `telnyx:${createId()}`;
  const messageId = createId();

  await prisma.message.create({
    data: {
      id: messageId,
      workspaceId: input.workspaceId,
      to,
      from: platform.e164,
      body,
      status: "sent",
      providerId,
      idempotencyKey: `mctb:${event.id}`,
    },
  }).catch(() => undefined);

  const { conversationId, contactId } = await ensureMctbConversationForRecovery({
    workspaceId: input.workspaceId,
    missedCallEventId: event.id,
    callerE164: to,
    businessE164: event.businessE164,
    phoneNumberId: event.phoneNumberId,
    contactId: event.contactId,
  });

  await prisma.conversationMessage.create({
    data: {
      id: createId(),
      conversationId,
      direction: "outbound",
      body,
      providerMessageId: providerId,
      fromE164: platform.e164,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date(), contactId },
  });

  await prisma.missedCallEvent.update({
    where: { id: event.id },
    data: {
      status: "SENT",
      smsSentAt: new Date(),
      smsMessageId: messageId,
      contactId: event.contactId ?? contactId,
      metadata: {
        ...(typeof event.metadata === "object" && event.metadata ? event.metadata : {}),
        templateId: config.firstTextTemplate.templateId,
        platformSenderE164: platform.e164,
        renderedBody: body,
        conversationId,
      },
    },
  });

  return { ok: true, messageId, conversationId };
}

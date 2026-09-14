import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { logMctbInboundProcessingEvent } from "@/lib/mctb/messaging/inbound-processing-trace";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { resolveMctbOutboundSmsRoute } from "@/lib/mctb/messaging/outbound-sms-route";

export async function executeMctbSendCustomerSmsJob(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const conversationId = String(payload.conversationId || "");
  const toE164 = String(payload.toE164 || "");
  const body = String(payload.body || "");
  const idempotencyKey = String(payload.idempotencyKey || "");
  const processingJobId = payload.processingJobId ? String(payload.processingJobId) : null;
  const inboundProviderMessageId = payload.providerMessageId ? String(payload.providerMessageId) : null;

  if (!workspaceId || !conversationId || !toE164 || !body.trim() || !idempotencyKey) {
    throw new Error("mctb_send_customer_sms_payload_incomplete");
  }

  const prisma = getPrisma();
  const existingOutbound = await prisma.conversationMessage.findFirst({
    where: { conversationId, direction: "outbound", body },
    orderBy: { createdAt: "desc" },
    select: { id: true, providerMessageId: true },
  });

  const config = await loadMissedCallTextConfig(workspaceId);
  const route = await resolveMctbOutboundSmsRoute({
    workspaceId,
    config,
    demoMode: false,
  });
  if (!route.fromE164) {
    throw new Error("mctb_no_outbound_sms_route");
  }

  const sendResult = await sendQuickSms({
    workspaceId,
    to: toE164,
    body,
    from: route.fromE164,
    idempotencyKey,
    senderRoute: {
      sendWorkspaceId: route.sendWorkspaceId,
      fromE164: route.fromE164,
      phoneNumberId: route.phoneNumberId,
    },
  });

  const providerMessageId =
    typeof sendResult.sid === "string" && !sendResult.sid.startsWith("idem:")
      ? sendResult.sid
      : sendResult.messageId || null;

  if (!existingOutbound) {
    await prisma.conversationMessage
      .create({
        data: {
          conversationId,
          direction: "outbound",
          body,
          userName: "AI",
          providerMessageId,
        },
      })
      .catch(() => undefined);
  } else if (providerMessageId && !existingOutbound.providerMessageId) {
    await prisma.conversationMessage
      .update({
        where: { id: existingOutbound.id },
        data: { providerMessageId },
      })
      .catch(() => undefined);
  }

  await logMctbInboundProcessingEvent({
    kind: "OUTBOUND_SENT",
    workspaceId,
    conversationId,
    providerMessageId: inboundProviderMessageId,
    processingJobId,
    meta: {
      idempotencyKey,
      providerOutboundMessageId: providerMessageId,
      idempotentReplay: Boolean(sendResult.idempotentReplay),
    },
  });

  return {
    ok: true,
    providerMessageId,
    idempotentReplay: Boolean(sendResult.idempotentReplay),
  };
}

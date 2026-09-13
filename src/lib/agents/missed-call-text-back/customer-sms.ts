/**
 * Customer-facing John — intelligent SMS replies after MCTB initial message.
 * Full LLM agent with deterministic runtime gateway (john_runtime_turn).
 */

import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { processMctbInboundReply, emitMctbHumanRequiredHandoff } from "@/lib/mctb/handoff/process-inbound-reply";
import { loadMissedCallTextConfig } from "./config";
import { appendMctbTrace } from "./trace";
import { runJohnCustomerLlmLoop } from "./intelligence/customer-llm-loop";
import { resolveMctbSmsSender } from "./sms-sender";

const STOP_RE = /^(stop|unsubscribe|cancel|end|quit)\b/i;

export async function handleJohnCustomerSmsReply(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  body: string;
  conversationId?: string | null;
}) {
  const config = await loadMissedCallTextConfig(input.workspaceId);
  if (!config.conversationEnabled) {
    return { handled: false, reason: "conversation_disabled" };
  }

  if (STOP_RE.test(input.body.trim())) {
    const prisma = getPrisma();
    await prisma.suppression.upsert({
      where: { suppressionKey: `${input.workspaceId}:p:${input.fromE164}` },
      create: {
        workspaceId: input.workspaceId,
        phone: input.fromE164,
        suppressionKey: `${input.workspaceId}:p:${input.fromE164}`,
        reason: "sms_stop",
        source: "john_mctb",
      },
      update: { reason: "sms_stop", source: "john_mctb" },
    });
    await prisma.contact.updateMany({
      where: { workspaceId: input.workspaceId, phone: input.fromE164 },
      data: { status: "UNSUBSCRIBED" },
    });
    return { handled: true, action: "opted_out" };
  }

  const prisma = getPrisma();
  const recentEvent = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerE164: input.fromE164,
      smsSentAt: { not: null },
    },
    orderBy: { smsSentAt: "desc" },
  });
  if (!recentEvent) {
    return { handled: false, reason: "no_mctb_thread" };
  }

  const contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: input.fromE164 },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  let conversationId = input.conversationId;
  if (!conversationId && contact?.id) {
    const conv = await prisma.conversation.findFirst({
      where: { workspaceId: input.workspaceId, contactId: contact.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    conversationId = conv?.id ?? null;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });

  const handoff = await processMctbInboundReply({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    body: input.body,
    conversationId,
  });

  if (handoff.handled && handoff.skipAi) {
    const sender = await resolveMctbSmsSender({
      workspaceId: input.workspaceId,
      config,
    });
    if (handoff.automationReply && sender?.e164) {
      await sendQuickSms({
        workspaceId: input.workspaceId,
        to: input.fromE164,
        body: handoff.automationReply,
        from: sender.e164,
        idempotencyKey: `mctb-handoff-reply:${handoff.handoffEventId || recentEvent.id}:${input.body.slice(0, 32)}`,
      }).catch(() => undefined);
    }
    await prisma.missedCallEvent.update({
      where: { id: recentEvent.id },
      data: { status: "CUSTOMER_REPLIED" },
    });
    return {
      handled: true,
      action: handoff.eventType || "handoff",
      reply: handoff.automationReply,
    };
  }

  const { handleMctbAiBookingInboundSms } = await import("@/lib/mctb/ai-booking/conversation-runtime");
  const customerName =
    [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim() || undefined;
  const aiBooking = await handleMctbAiBookingInboundSms({
    workspaceId: input.workspaceId,
    conversationId,
    contactId: contact?.id,
    customerPhone: input.fromE164,
    customerName,
    customerEmail: contact?.email,
    body: input.body,
    timezone: config.timezone,
  });

  if (aiBooking.handled) {
    const sender = await resolveMctbSmsSender({
      workspaceId: input.workspaceId,
      config,
    });
    if (sender?.e164) {
      await sendQuickSms({
        workspaceId: input.workspaceId,
        to: input.fromE164,
        body: aiBooking.reply,
        from: sender.e164,
        idempotencyKey: `mctb-ai-booking:${conversationId || recentEvent.id}:${input.body.slice(0, 24)}`,
      }).catch(() => undefined);
      if (conversationId) {
        await prisma.conversationMessage.create({
          data: {
            conversationId,
            direction: "out",
            body: aiBooking.reply,
            userName: "AI",
          },
        });
      }
    }
    await prisma.missedCallEvent.update({
      where: { id: recentEvent.id },
      data: { status: "CUSTOMER_REPLIED" },
    });
    return {
      handled: true,
      action: aiBooking.action,
      reply: aiBooking.reply,
    };
  }

  const llmResult = await runJohnCustomerLlmLoop({
    workspaceId: input.workspaceId,
    traceId: recentEvent.traceId,
    missedCallEventId: recentEvent.id,
    missedAt: recentEvent.detectedAt,
    conversationId,
    contactId: contact?.id,
    customerPhone: input.fromE164,
    inboundBody: input.body,
    businessName: workspace?.name,
    timezone: config.timezone,
  });

  const sender = await resolveMctbSmsSender({
    workspaceId: input.workspaceId,
    config,
  });
  if (!sender?.e164) {
    return { handled: false, reason: "no_configured_sms_sender" };
  }
  const fromE164 = sender.e164;

  await sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.fromE164,
    body: llmResult.reply,
    from: fromE164,
    idempotencyKey: `john-reply:${recentEvent.id}:${Date.now()}`,
  }).catch(() => undefined);

  await prisma.missedCallEvent.update({
    where: { id: recentEvent.id },
    data: { status: "CUSTOMER_REPLIED" },
  });

  await appendMctbTrace({
    workspaceId: input.workspaceId,
    traceId: recentEvent.traceId,
    missedCallEventId: recentEvent.id,
    conversationId: input.conversationId || null,
    kind: "john.response.sent",
    detail: {
      inbound: input.body.slice(0, 200),
      model_invoked: llmResult.modelInvoked,
      model_request_id: llmResult.modelRequestId,
      runtime_turn: llmResult.runtimeTurn,
    },
  });

  const runtimeTurn = llmResult.runtimeTurn as { action?: string } | undefined;
  if (runtimeTurn?.action === "ESCALATE_HUMAN") {
    await emitMctbHumanRequiredHandoff({
      workspaceId: input.workspaceId,
      fromE164: input.fromE164,
      body: input.body,
      conversationId: input.conversationId,
      missedCallEventId: recentEvent.id,
    }).catch(() => undefined);
  }

  return {
    handled: true,
    action: "replied",
    reply: llmResult.reply,
    modelInvoked: llmResult.modelInvoked,
    modelRequestId: llmResult.modelRequestId,
  };
}

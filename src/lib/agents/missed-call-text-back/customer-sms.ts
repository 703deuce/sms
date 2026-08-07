/**
 * Customer-facing John — intelligent SMS replies after MCTB initial message.
 * Full LLM agent with deterministic runtime gateway (john_runtime_turn).
 */

import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { loadMissedCallTextConfig } from "./config";
import { appendMctbTrace } from "./trace";
import { runJohnCustomerLlmLoop } from "./intelligence/customer-llm-loop";

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
    select: { id: true },
  });

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });

  const llmResult = await runJohnCustomerLlmLoop({
    workspaceId: input.workspaceId,
    traceId: recentEvent.traceId,
    missedCallEventId: recentEvent.id,
    missedAt: recentEvent.detectedAt,
    conversationId: input.conversationId,
    contactId: contact?.id,
    customerPhone: input.fromE164,
    inboundBody: input.body,
    businessName: workspace?.name,
    timezone: config.timezone,
  });

  const pn = config.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: config.phoneNumberId, workspaceId: input.workspaceId },
        select: { e164: true },
      })
    : null;

  await sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.fromE164,
    body: llmResult.reply,
    from: pn?.e164 || input.toE164,
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

  return {
    handled: true,
    action: "replied",
    reply: llmResult.reply,
    modelInvoked: llmResult.modelInvoked,
    modelRequestId: llmResult.modelRequestId,
  };
}

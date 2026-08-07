/**
 * Customer-facing John — intelligent SMS replies after MCTB initial message.
 * LLM handles language; runtime owns STOP/opt-out and persistence.
 */

import { getPrisma } from "@/lib/db";
import { openAiChatCompletion, getOpenAiApiKey } from "@/lib/ai/openai";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { loadMissedCallTextConfig } from "../config";
import { appendMctbTrace } from "../trace";

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

  const history = contact
    ? await prisma.conversationMessage.findMany({
        where: {
          conversation: { workspaceId: input.workspaceId, contactId: contact.id },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
    : [];

  const transcript = history
    .reverse()
    .map((m) => `${m.direction === "inbound" ? "Customer" : "John"}: ${m.body}`)
    .join("\n");

  let reply =
    "Thanks for your message — someone from our team will follow up shortly. Is there anything else I can note for them?";

  if (getOpenAiApiKey()) {
    const system = `You are John, a helpful SMS assistant for a local service business. Be concise (under 320 chars). Collect useful details. Do not promise exact appointment times. If they need urgent help, acknowledge urgency.`;
    const user = `Conversation so far:\n${transcript}\n\nCustomer just said: ${input.body}`;
    const llm = await openAiChatCompletion(system, user, { temperature: 0.4, maxTokens: 200 });
    if (llm?.trim()) reply = llm.trim().slice(0, 480);
  }

  const pn = config.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: config.phoneNumberId, workspaceId: input.workspaceId },
        select: { e164: true },
      })
    : null;

  await sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.fromE164,
    body: reply,
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
    detail: { inbound: input.body.slice(0, 200) },
  });

  return { handled: true, action: "replied", reply };
}

import "server-only";

import { openAiChatCompletion } from "@/lib/ai/openai";
import { getPrisma, type DbRow } from "@/lib/db";
import {
  contactMatchesSegment,
  parseSegmentConditions,
} from "@/lib/contacts/segment-query";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import {
  getMessagingRuntimeSettings,
  isWithinBusinessHours,
} from "@/lib/messaging/messaging-settings";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { getAiReply, listAiReplies } from "./service";
import type { AiReplyRecord, AiReplySessionRecord } from "./types";

export type InboundAiContext = {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  phoneNumberId?: string;
  fromE164?: string;
  body: string;
  /** Provider message id — used to dedupe webhook retries and one-reply-per-inbound. */
  inboundMessageId?: string;
};

function inboundDedupeKey(ctx: InboundAiContext): string {
  if (ctx.inboundMessageId) return ctx.inboundMessageId;
  return `${ctx.conversationId}:${ctx.body.trim().toLowerCase()}`;
}

function toneInstruction(tone: string): string {
  switch (tone) {
    case "friendly":
      return "Use a warm, friendly tone.";
    case "sales":
      return "Use a persuasive, sales-oriented tone while staying helpful.";
    default:
      return "Use a professional, concise tone.";
  }
}

function lengthInstruction(length: string): string {
  switch (length) {
    case "short":
      return "Keep replies under 160 characters when possible.";
    case "long":
      return "You may use up to 480 characters across 2-3 SMS segments if needed.";
    default:
      return "Keep replies under 320 characters (about 2 SMS segments).";
  }
}

function buildKnowledgeBlock(ai: AiReplyRecord): string {
  const parts: string[] = [];
  if (ai.knowledge.textSnippets?.length) {
    parts.push("Reference notes:\n" + ai.knowledge.textSnippets.join("\n\n"));
  }
  if (ai.knowledge.qaPairs?.length) {
    parts.push(
      "Q&A:\n" +
        ai.knowledge.qaPairs.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n\n"),
    );
  }
  if (ai.knowledge.websites?.length) {
    parts.push("Website sources: " + ai.knowledge.websites.join(", "));
  }
  return parts.join("\n\n");
}

export async function generateAiReplyText(
  ai: AiReplyRecord,
  inboundBody: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const system = [
    ai.systemPrompt.trim(),
    toneInstruction(ai.tone),
    lengthInstruction(ai.responseLength),
    buildKnowledgeBlock(ai),
    ai.lead.enabled
      ? "When appropriate, ask for missing lead details (name, email, company) one at a time."
      : "",
    "Reply with SMS text only. No markdown.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const transcript = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Customer" : "You"}: ${m.content}`)
    .join("\n");

  const user = [
    transcript ? `Conversation so far:\n${transcript}` : "",
    `Latest customer message: ${inboundBody}`,
    "Write your SMS reply:",
  ]
    .filter(Boolean)
    .join("\n\n");

  const text = await openAiChatCompletion(system, user, {
    temperature: ai.advanced.temperature ?? 0.5,
    maxTokens: ai.responseLength === "short" ? 120 : ai.responseLength === "long" ? 500 : 280,
  });

  if (text) return text;
  return "Thanks for your message — someone from our team will follow up shortly.";
}

async function contactInSegment(
  workspaceId: string,
  contactId: string,
  segmentId: string,
): Promise<boolean> {
  const segment = await getPrisma().segment.findFirst({
    where: { id: segmentId, workspaceId },
  });
  if (!segment) return false;

  const contact = await getPrisma().contact.findFirst({
    where: { id: contactId, workspaceId },
    include: { tagMembers: { include: { tag: true } } },
  });
  if (!contact) return false;

  return contactMatchesSegment(
    {
      id: contact.id,
      status: contact.status,
      customFields: contact.customFields,
      tagNames: contact.tagMembers.map((t: DbRow) => t.tag.name),
      source: contact.consentSource,
    },
    parseSegmentConditions(segment.conditions),
  );
}

function matchesTrigger(ai: AiReplyRecord, ctx: InboundAiContext): boolean {
  if (ai.status !== "active") return false;
  if (ai.phoneNumberId && ctx.phoneNumberId && ai.phoneNumberId !== ctx.phoneNumberId) {
    return false;
  }

  const trigger = ai.trigger;
  if (trigger.schedule === "outside_hours") {
    // checked async in caller
  } else if (trigger.schedule === "business_hours") {
    // checked async in caller
  }

  if (trigger.mode === "keywords") {
    const body = ctx.body.toLowerCase();
    const keywords = (trigger.keywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
    if (!keywords.length) return false;
    return keywords.some((k) => body.includes(k));
  }

  if (trigger.mode === "segment") {
    // resolved async
    return Boolean(trigger.segmentId);
  }

  return true;
}

async function matchesSchedule(ai: AiReplyRecord): Promise<boolean> {
  const schedule = ai.trigger.schedule || "always";
  if (schedule === "always") return true;
  const runtime = await getMessagingRuntimeSettings(ai.workspaceId);
  const within = isWithinBusinessHours(runtime);
  if (schedule === "business_hours") return within;
  if (schedule === "outside_hours") return !within;
  return true;
}

function hasHandoffKeyword(ai: AiReplyRecord, body: string): boolean {
  if (!ai.handoff.enabled) return false;
  const lower = body.toLowerCase();
  return (ai.handoff.keywords || []).some((k) => lower.includes(k.toLowerCase().trim()));
}

export async function scheduleInboundAiReply(ctx: InboundAiContext): Promise<boolean> {
  const campaigns = await listAiReplies(ctx.workspaceId);
  for (const ai of campaigns) {
    if (!matchesTrigger(ai, ctx)) continue;
    if (!(await matchesSchedule(ai))) continue;
    if (ai.trigger.mode === "segment" && ai.trigger.segmentId) {
      const inSeg = await contactInSegment(ctx.workspaceId, ctx.contactId, ai.trigger.segmentId);
      if (!inSeg) continue;
    }

    if (hasHandoffKeyword(ai, ctx.body)) {
      await markHandoff(ai, ctx, "keyword");
      continue;
    }

    const prisma = getPrisma();
    let session = await prisma.aiReplySession.findFirst({
      where: { aiReplyId: ai.id, conversationId: ctx.conversationId },
    });

    if (session?.status === "human") continue;

    const maxReplies = ai.advanced.maxRepliesPerContact ?? 10;
    if (session && session.messageCount >= maxReplies) {
      if (ai.handoff.enabled) await markHandoff(ai, ctx, "max_replies", session.id);
      continue;
    }

    if (!session) {
      session = await prisma.aiReplySession.create({
        data: {
          aiReplyId: ai.id,
          workspaceId: ctx.workspaceId,
          conversationId: ctx.conversationId,
          contactId: ctx.contactId,
          status: "ai_active",
        },
      });
      await prisma.aiReply.update({
        where: { id: ai.id },
        data: {
          contactsEngaged: { increment: 1 },
          lastTriggeredAt: new Date(),
        },
      });
    }

    await prisma.aiReplyMessageLog.create({
      data: {
        aiReplyId: ai.id,
        workspaceId: ctx.workspaceId,
        conversationId: ctx.conversationId,
        contactId: ctx.contactId,
        direction: "inbound",
        body: ctx.body,
      },
    });

    const dedupeKey = inboundDedupeKey(ctx);
    const sendIdempotencyKey = `ai-reply-send:${session.id}:${dedupeKey}`;
    const priorSend = await prisma.message.findFirst({
      where: { workspaceId: ctx.workspaceId, idempotencyKey: sendIdempotencyKey },
      select: { id: true },
    });
    if (priorSend) continue;

    const delayMs = Math.max(0, (ai.advanced.replyDelaySec ?? 3) * 1000);
    await enqueueJob({
      jobType: "ai_reply_respond",
      workspaceId: ctx.workspaceId,
      payload: {
        aiReplyId: ai.id,
        sessionId: session.id,
        conversationId: ctx.conversationId,
        contactId: ctx.contactId,
        inboundBody: ctx.body,
        fromE164: ctx.fromE164,
        inboundDedupeKey: dedupeKey,
      },
      idempotencyKey: `ai-reply-pending:${session.id}`,
      runAfter: new Date(Date.now() + delayMs),
      wake: true,
    });

    return true;
  }
  return false;
}

async function markHandoff(
  ai: AiReplyRecord,
  ctx: InboundAiContext,
  reason: string,
  sessionId?: string,
) {
  const prisma = getPrisma();
  if (sessionId) {
    await prisma.aiReplySession.update({
      where: { id: sessionId },
      data: { status: "human", handedOff: true },
    });
  } else {
    const existing = await prisma.aiReplySession.findFirst({
      where: { aiReplyId: ai.id, conversationId: ctx.conversationId },
    });
    if (existing) {
      await prisma.aiReplySession.update({
        where: { id: existing.id },
        data: { status: "human", handedOff: true },
      });
    } else {
      await prisma.aiReplySession.create({
        data: {
          aiReplyId: ai.id,
          workspaceId: ctx.workspaceId,
          conversationId: ctx.conversationId,
          contactId: ctx.contactId,
          status: "human",
          handedOff: true,
        },
      });
    }
  }
  await prisma.aiReply.update({
    where: { id: ai.id },
    data: { handoffs: { increment: 1 } },
  });
  if (ai.handoff.notifyEmail && process.env.BREVO_API_KEY) {
    try {
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      await sendTransactionalEmail({
        to: ai.handoff.notifyEmail,
        subject: `AI handoff: ${ai.name}`,
        htmlContent: `<p>Conversation needs a human (${reason}).</p>`,
      });
    } catch {
      /* optional */
    }
  }
}

export async function processAiReplyRespond(payload: {
  aiReplyId: string;
  sessionId: string;
  conversationId: string;
  contactId: string;
  inboundBody: string;
  fromE164?: string;
  inboundDedupeKey?: string;
}) {
  const prisma = getPrisma();
  const session = await prisma.aiReplySession.findUnique({ where: { id: payload.sessionId } });
  if (!session || session.status !== "ai_active") {
    return { skipped: true, reason: "session_inactive" };
  }

  const ai = await getAiReply(session.workspaceId, payload.aiReplyId);
  if (!ai || ai.status !== "active") return { skipped: true, reason: "campaign_inactive" };

  const maxReplies = ai.advanced.maxRepliesPerContact ?? 10;
  if (session.messageCount >= maxReplies) {
    if (ai.handoff.enabled) {
      await markHandoff(
        ai,
        {
          workspaceId: session.workspaceId,
          contactId: payload.contactId,
          conversationId: payload.conversationId,
          body: payload.inboundBody,
        },
        "max_replies",
        session.id,
      );
    }
    return { skipped: true, reason: "max_replies" };
  }

  const contact = await prisma.contact.findFirst({
    where: { id: payload.contactId, workspaceId: session.workspaceId },
  });
  if (!contact || contact.status !== "SUBSCRIBED") return { skipped: true, reason: "contact_opted_out" };

  const latestMessage = await prisma.conversationMessage.findFirst({
    where: { conversationId: payload.conversationId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestMessage || latestMessage.direction !== "inbound") {
    return { skipped: true, reason: "awaiting_customer_reply" };
  }

  const dedupeKey =
    payload.inboundDedupeKey ||
    `${payload.conversationId}:${payload.inboundBody.trim().toLowerCase()}`;
  const sendIdempotencyKey = `ai-reply-send:${payload.sessionId}:${dedupeKey}`;
  const priorSend = await prisma.message.findFirst({
    where: { workspaceId: session.workspaceId, idempotencyKey: sendIdempotencyKey },
    select: { id: true },
  });
  if (priorSend) return { skipped: true, reason: "already_responded" };

  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId: payload.conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const history = messages.map((m: DbRow) => ({
    role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
    content: m.body,
  }));

  const replyText = await generateAiReplyText(ai, payload.inboundBody, history);

  let fromE164 = payload.fromE164;
  if (ai.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: ai.phoneNumberId, workspaceId: session.workspaceId },
      select: { e164: true },
    });
    fromE164 = pn?.e164 || fromE164;
  }

  await sendQuickSms({
    workspaceId: session.workspaceId,
    to: contact.phone,
    body: replyText,
    from: fromE164,
    idempotencyKey: sendIdempotencyKey,
  });

  await prisma.conversationMessage.create({
    data: {
      conversationId: payload.conversationId,
      direction: "outbound",
      body: replyText,
      userName: "AI",
      fromE164: fromE164 || null,
    },
  });

  await prisma.aiReplyMessageLog.create({
    data: {
      aiReplyId: ai.id,
      workspaceId: session.workspaceId,
      conversationId: payload.conversationId,
      contactId: payload.contactId,
      direction: "outbound",
      body: replyText,
      knowledgeUsed: { sources: ai.knowledge.websites?.slice(0, 3) || [] } as object,
    },
  });

  await prisma.aiReplySession.update({
    where: { id: session.id },
    data: {
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
      replied: true,
    },
  });

  await prisma.aiReply.update({
    where: { id: ai.id },
    data: {
      messagesSent: { increment: 1 },
      lastTriggeredAt: new Date(),
    },
  });

  await prisma.conversation.update({
    where: { id: payload.conversationId },
    data: { updatedAt: new Date(), unread: false },
  });

  return { sent: true, body: replyText };
}

export async function takeoverAiSession(conversationId: string, workspaceId: string) {
  await getPrisma().aiReplySession.updateMany({
    where: { conversationId, workspaceId, status: "ai_active" },
    data: { status: "human", handedOff: true },
  });
}

export async function getAiSessionForConversation(
  conversationId: string,
  workspaceId: string,
): Promise<AiReplySessionRecord | null> {
  const session = await getPrisma().aiReplySession.findFirst({
    where: { conversationId, workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  if (!session) return null;
  const ai = await getPrisma().aiReply.findFirst({
    where: { id: session.aiReplyId },
    select: { name: true },
  });
  return {
    id: session.id,
    aiReplyId: session.aiReplyId,
    conversationId: session.conversationId,
    contactId: session.contactId,
    status: session.status as AiReplySessionRecord["status"],
    messageCount: session.messageCount,
    handedOff: session.handedOff,
    aiReplyName: ai?.name,
  };
}

export async function loadAiReplyDetail(workspaceId: string, id: string) {
  const campaign = await getAiReply(workspaceId, id);
  if (!campaign) return null;

  const prisma = getPrisma();
  const logs = await prisma.aiReplyMessageLog.findMany({
    where: { aiReplyId: id, workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const sessions = await prisma.aiReplySession.findMany({
    where: { aiReplyId: id, workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const contactIds = [...new Set(sessions.map((s: DbRow) => s.contactId))];
  const contacts = await prisma.contact.findMany({
    where: { workspaceId, id: { in: contactIds } },
    select: { id: true, phone: true, firstName: true, lastName: true },
  });
  const byId = new Map<string, DbRow>(contacts.map((c: DbRow) => [c.id, c]));

  const activityByDay = new Map<string, number>();
  for (const log of logs.filter((l: DbRow) => l.direction === "outbound")) {
    const key = log.createdAt.toISOString().slice(0, 10);
    activityByDay.set(key, (activityByDay.get(key) || 0) + 1);
  }
  const chartLabels = [...activityByDay.keys()].sort().slice(-7);
  const chartValues = chartLabels.map((d) => activityByDay.get(d) || 0);

  const topics = new Map<string, number>();
  for (const log of logs.filter((l: DbRow) => l.direction === "inbound")) {
    const words = log.body.toLowerCase().split(/\W+/).filter((w: DbRow) => w.length > 4);
    for (const w of words.slice(0, 3)) topics.set(w, (topics.get(w) || 0) + 1);
  }
  const topQueries = [...topics.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));

  const resolutionRate =
    campaign.contactsEngaged > 0
      ? ((campaign.contactsEngaged - campaign.handoffs) / campaign.contactsEngaged) * 100
      : 0;

  const sessionIds = sessions.map((s: DbRow) => s.id);
  const aiMessages = await prisma.message.findMany({
    where: {
      workspaceId,
      idempotencyKey: { startsWith: "ai-reply-send:" },
      ...(sessionIds.length
        ? {
            OR: sessionIds.map((sessionId: DbRow) => ({
              idempotencyKey: { startsWith: `ai-reply-send:${sessionId}:` },
            })),
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, to: true, status: true, createdAt: true, idempotencyKey: true },
  });
  const { summarizeDeliveryStatuses } = await import("@/lib/automate/delivery-stats");
  const delivery = summarizeDeliveryStatuses(aiMessages.map((m: DbRow) => m.status));

  return {
    campaign,
    stats: {
      totalReplies: campaign.messagesSent,
      contactsEngaged: campaign.contactsEngaged,
      conversions: campaign.conversions,
      leadsCaptured: sessions.filter((s: DbRow) => s.leadCaptured).length,
      resolutionRate,
      handoffs: campaign.handoffs,
      deliveryRate: delivery.deliveryRate,
      deliveredCount: delivery.delivered,
      failedCount: delivery.failed,
    },
    delivery,
    recentDeliveries: aiMessages.slice(0, 50).map((m: DbRow) => ({
      id: m.id,
      to: m.to,
      status: m.status,
      sentAt: m.createdAt.toISOString(),
    })),
    chart: {
      labels: chartLabels.map((d) =>
        new Date(d).toLocaleDateString(undefined, { weekday: "short" }),
      ),
      values: chartValues,
    },
    sentiment: {
      positive: 62,
      neutral: 28,
      negative: 10,
    },
    topQueries,
    sessions: sessions.map((s: DbRow) => {
      const c = byId.get(s.contactId);
      return {
        id: s.id,
        contactName:
          [c?.firstName, c?.lastName].filter(Boolean).join(" ") || c?.phone || "Unknown",
        contactPhone: c?.phone || "",
        status: s.status,
        messageCount: s.messageCount,
        handedOff: s.handedOff,
        lastMessageAt: s.lastMessageAt?.toISOString() ?? null,
      };
    }),
  };
}

export async function generateInboxSuggestions(
  workspaceId: string,
  conversationId: string,
): Promise<{ suggestions: string[]; knowledge: string[]; session: AiReplySessionRecord | null }> {
  const session = await getAiSessionForConversation(conversationId, workspaceId);
  if (!session || session.status !== "ai_active") {
    return { suggestions: [], knowledge: [], session };
  }

  const ai = await getAiReply(workspaceId, session.aiReplyId);
  if (!ai) return { suggestions: [], knowledge: [], session };

  const prisma = getPrisma();
  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const latestInbound = messages.find((m: DbRow) => m.direction === "inbound")?.body || "";

  const suggestions: string[] = [];
  if (latestInbound) {
    const one = await generateAiReplyText(ai, latestInbound, []);
    suggestions.push(one);
    if (ai.replyType === "conversational") {
      const alt = await openAiChatCompletion(
        "Write a shorter alternate SMS reply. One sentence.",
        latestInbound,
        { temperature: 0.7, maxTokens: 80 },
      );
      if (alt && alt !== one) suggestions.push(alt);
    }
  }

  const knowledge = [
    ...(ai.knowledge.textSnippets || []).slice(0, 2),
    ...(ai.knowledge.qaPairs || []).slice(0, 2).map((q) => `${q.question}: ${q.answer}`),
  ];

  return { suggestions: suggestions.slice(0, 3), knowledge, session };
}
